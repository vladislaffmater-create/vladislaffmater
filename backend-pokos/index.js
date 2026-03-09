require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// ——— Rate limit: общий для API и жёсткие лимиты для заявок и авторизации ———
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 минут

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_API_MAX, 10) || 150,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bookingsLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_BOOKINGS_MAX, 10) || 10,
  message: { error: 'Слишком много заявок с вашего адреса. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5,
  message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/$/, ""); // например https://pokos-obninsk.ru

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    if (FRONTEND_URL && origin === FRONTEND_URL) return cb(null, true);
    cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/api', apiLimiter);

const pool = new Pool();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

/** Приводит телефон к единому виду в БД: только цифры, код 8 (8XXXXXXXXXX). */
function normalizePhoneTo8(phone) {
  if (!phone || typeof phone !== 'string') return (phone || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '7') {
    return '8' + digits.slice(1);
  }
  if (digits.length === 10 && /^[79]\d{9}$/.test(digits)) {
    return '8' + digits;
  }
  return digits;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нет токена' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, fullName, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email и пароль обязательны' });
  }

  const hash = await bcrypt.hash(password, 10);
  const phoneNormalized = phone ? normalizePhoneTo8(phone) : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone)
       VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name, phone`,
      [email, hash, fullName || null, phoneNormalized]
    );
    const user = rows[0];

    await pool.query(
      `INSERT INTO loyalty (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Пользователь с таким email уже есть' });
    }
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Неверные email или пароль' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверные email или пароль' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone },
  });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.phone,
            l.points, l.level, l.total_orders
     FROM users u
     LEFT JOIN loyalty l ON l.user_id = u.id
     WHERE u.id=$1`,
    [req.user.id]
  );
  res.json(rows[0]);
});

app.post('/api/bookings', bookingsLimiter, async (req, res) => {
  const {
    fullName,
    phone,
    serviceType,
    area,
    slot,
    address,
    comment,
    userId,
    source,
  } = req.body;

  if (!fullName || !phone || !serviceType || !slot || !address) {
    return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
  }

  const phoneNormalized = normalizePhoneTo8(phone);
  const { rows } = await pool.query(
    `INSERT INTO bookings (user_id, full_name, phone, service_type, area, slot, address, comment, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      userId || null,
      fullName,
      phoneNormalized || phone,
      serviceType,
      area || null,
      slot,
      address,
      comment || null,
      source || null,
    ]
  );
  res.json(rows[0]);
});

app.get('/api/bookings', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM bookings ORDER BY created_at DESC'
  );
  res.json(rows);
});

app.patch('/api/bookings/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, adminComment } = req.body;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Некорректный id' });
  const fields = [];
  const values = [];

  if (status && typeof status === 'string') {
    fields.push('status');
    values.push(status.trim());
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'adminComment')) {
    fields.push('admin_comment');
    if (adminComment == null || adminComment === '') {
      values.push(null);
    } else {
      values.push(String(adminComment).trim());
    }
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'Укажите хотя бы одно поле для обновления' });
  }

  const setClause = fields
    .map((field, idx) => `${field} = $${idx + 1}`)
    .join(', ');

  values.push(id);

  const { rows } = await pool.query(
    `UPDATE bookings SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Заявка не найдена' });
  res.json(rows[0]);
});

app.get('/api/my-bookings', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM bookings WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// ——— Акции (промо): хранение в БД, публичное чтение ———
// Таблица: site_settings (key TEXT PRIMARY KEY, value JSONB). Ключ 'promos' — массив акций.

app.get('/api/promos', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM site_settings WHERE key = 'promos' LIMIT 1`
    );
    if (!rows.length || rows[0].value == null) {
      return res.json([]);
    }
    const value = rows[0].value;
    const list = Array.isArray(value) ? value : [];
    res.json(list);
  } catch (e) {
    console.error('GET /api/promos', e);
    res.status(500).json({ error: 'Ошибка при загрузке акций' });
  }
});

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

app.put('/api/promos', async (req, res) => {
  if (ADMIN_SECRET && req.get('X-Admin-Key') !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Неверный ключ администратора' });
  }
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Ожидается массив акций' });
  }
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('promos', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
      [JSON.stringify(list)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/promos', e);
    res.status(500).json({ error: 'Ошибка при сохранении акций' });
  }
});

const PORT = 4000;

const DEFAULT_PROMOS = [
  { id: "p1", badge: "-10%", title: "Скидка 10% на первый заказ", description: "Для новых клиентов — скидка 10% на первый выезд при заказе от 5 соток. Действует на любые виды покоса.", points: ["Работает для частных и коммерческих клиентов", "Можно сочетать с доп. услугами по стандартной цене"], promoValue: "Скидка 10% на первый заказ" },
  { id: "p2", badge: "Весна", title: "Заказ до 15 мая", description: "При бронировании работ до 15 мая вы получаете выбор: дополнительная скидка 5% или бесплатный вывоз травы.", points: ["Актуально для сезонного первого покоса", "Выбор опции согласуем при подтверждении заказа"], promoValue: "Весенняя акция до 15 мая" },
  { id: "p3", badge: "+5%", title: "Накопительная скидка 5%", description: "После трёх выполненных заказов вы получаете постоянную скидку 5% на все последующие выезды.", points: ["Подходит для дачников и управляющих компаний", "Скидка действует при любой площади участка"], promoValue: "Накопительная скидка 5%" },
  { id: "p4", badge: "-500 ₽", title: "Приведи друга", description: "Рекомендуйте нас знакомым и соседям — за каждого нового клиента вы получаете скидку 500 ₽ на свой следующий заказ.", points: ["Скидки можно суммировать при нескольких рекомендациях", "Акция действует для заказов от 5 соток"], promoValue: "Приведи друга — скидка 500 ₽" },
];

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value JSONB
      )
    `);
    const { rows } = await pool.query(`SELECT value FROM site_settings WHERE key = 'promos' LIMIT 1`);
    const hasPromos = rows.length && rows[0].value != null && Array.isArray(rows[0].value) && rows[0].value.length > 0;
    if (!hasPromos) {
      await pool.query(
        `INSERT INTO site_settings (key, value) VALUES ('promos', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
        [JSON.stringify(DEFAULT_PROMOS)]
      );
      console.log('Акции: в БД подставлены акции по умолчанию.');
    }
  } catch (e) {
    console.error('Ошибка инициализации site_settings:', e.message);
  }
  app.listen(PORT, () => {
    console.log(`API запущено на http://localhost:${PORT}`);
  });
})();

