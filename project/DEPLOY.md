# Как выложить сайт в интернет

Кратко: **фронт** (HTML/CSS/JS) — на статический хостинг или свой сервер, **бэкенд** (Node.js + PostgreSQL) — на отдельный хостинг или тот же сервер. Ниже — варианты и полный чеклист замены домена.

---

## 1. Куда выложить фронт (сайт)

### Вариант A: Бесплатный статический хостинг (проще всего)

- **Netlify** (https://www.netlify.com): зарегистрируйтесь, перетащите папку `project` в Drop zone или подключите GitHub и укажите папку с фронтом. Сайт получит адрес вида `ваш-проект.netlify.app`, можно привязать свой домен.
- **Vercel** (https://vercel.com): аналогично — импорт проекта или GitHub, указать папку `project`.
- **GitHub Pages**: создайте репозиторий, залейте содержимое папки `project` в ветку `main` (или в папку `docs`), в настройках репозитория включите Pages. Сайт будет по адресу `ваш-логин.github.io/имя-репо` или по своему домену.

После выкладки вы получите **адрес сайта** (например `https://pokos-obninsk.ru` или `https://mysite.netlify.app`). Он понадобится для чеклиста ниже.

### Вариант B: Свой сервер (VPS)

На сервере с Linux (Ubuntu и т.п.) поставьте **nginx** и отдавайте статику из папки с файлами проекта. Пример конфига nginx:

```nginx
server {
    listen 80;
    server_name pokos-obninsk.ru;
    root /var/www/pokos;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Папку `project` скопируйте в `/var/www/pokos` (или как назовёте).

---

## 2. Куда выложить бэкенд (API)

Фронт обращается к API по адресу, который вы задаёте как `POKOS_API_BASE`. Этот адрес должен вести на работающий Node.js-сервер и базу PostgreSQL.

### Вариант A: Облачный хостинг с БД

- **Railway** (https://railway.app): можно развернуть Node.js и PostgreSQL, получите URL вида `https://ваш-проект.up.railway.app`.
- **Render** (https://render.com): Web Service для Node.js + отдельная PostgreSQL БД.
- **Fly.io**, **DigitalOcean App Platform** — аналогичные варианты.

В настройках сервиса укажите: переменные окружения из `.env` (PGHOST, PGDATABASE, JWT_SECRET и т.д.), команду запуска `node index.js` или `npm start`. Для продакшена добавьте переменную **FRONTEND_URL** = адрес вашего сайта (см. ниже).

### Вариант B: Тот же VPS, что и фронт

На том же сервере установите Node.js и PostgreSQL. Запускайте бэкенд через **PM2**: `pm2 start index.js --name api`. В nginx добавьте проксирование на порт, где слушает Node (например 4000):

```nginx
location /api {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Тогда API будет доступно по адресу `https://pokos-obninsk.ru/api` и в качестве `POKOS_API_BASE` вы укажете `https://pokos-obninsk.ru` (без `/api` — в коде уже идёт путь `/api/promos` и т.д.). Либо поднимите API на поддомене, например `https://api.pokos-obninsk.ru`.

---

## 3. Чеклист: где поставить свой домен и адрес API

Перед публикацией замените плейсхолдеры на свои значения.

**Что подставить:**

- **Домен сайта** — адрес, по которому открывается фронт, например `https://pokos-obninsk.ru` (без слэша в конце).
- **Адрес API** — URL, по которому доступен бэкенд, например `https://api.pokos-obninsk.ru` или `https://ваш-проект.up.railway.app`.

---

### Фронт (папка `project`)

| Файл | Что искать | На что заменить |
|------|------------|------------------|
| **robots.txt** | `https://yoursite.ru` | Ваш домен сайта (2 места: комментарий и строка Sitemap) |
| **sitemap.xml** | `https://yoursite.ru` | Ваш домен сайта (во всех тегах `<loc>`, 8 мест) |
| **index.html** | `content="https://yoursite.ru/"` в `<meta property="og:url"` | Ваш домен + `/` |
| **services.html** | `content="https://yoursite.ru/services.html"` (og:url) | Ваш домен + `/services.html` |
| **booking.html** | `content="https://yoursite.ru/booking.html"` (og:url) | Ваш домен + `/booking.html` |
| **reviews.html** | `content="https://yoursite.ru/reviews.html"` (og:url) | Ваш домен + `/reviews.html` |
| **promo.html** | `content="https://yoursite.ru/promo.html"` (og:url) | Ваш домен + `/promo.html` |
| **contacts.html** | `content="https://yoursite.ru/contacts.html"` (og:url) | Ваш домен + `/contacts.html` |
| **admin.html** | `content="https://yoursite.ru/admin.html"` (og:url) | Ваш домен + `/admin.html` |
| **account.html** | `content="https://yoursite.ru/account.html"` (og:url) | Ваш домен + `/account.html` |

**Адрес API (POKOS_API_BASE):** на страницах, которые ходят к бэкенду, нужно один раз задать глобальную переменную **до** подключения скриптов. Добавьте в `<head>` первой строкой перед другими `<script>`:

- **booking.html** — перед `js/booking.js`:
  ```html
  <script>window.POKOS_API_BASE = "https://ваш-адрес-api";</script>
  ```
- **promo.html** — перед `js/promo.js`
- **admin.html** — перед `js/admin.js`
- **account.html** — перед `js/auth.js`

Во всех четырёх файлах одна и та же строка с вашим реальным URL API (например `https://api.pokos-obninsk.ru`). Если не добавить, в браузере будет использоваться `http://localhost:4000` и запросы уйдут не на ваш сервер.

**Итог по фронту:** заменить `yoursite.ru` на свой домен в 10 файлах (robots, sitemap, 8 HTML с og:url) и в 4 HTML добавить (или поправить) `window.POKOS_API_BASE`.

---

### Бэкенд (папка `backend-pokos`)

| Где | Что сделать |
|-----|-------------|
| **.env** (на сервере или в настройках хостинга) | Добавить переменную **FRONTEND_URL** = адрес вашего сайта, например `https://pokos-obninsk.ru`. Тогда CORS разрешит запросы с этого домена. Без этого браузер будет блокировать ответы API. |
| Остальные переменные | PGHOST, PGDATABASE, JWT_SECRET и т.д. — как в README_backend.md, значения для вашей БД и окружения. |

В коде бэкенда домен нигде не захардкожен: список разрешённых origin берётся из localhost и из `FRONTEND_URL`.

---

## 4. Как быстро найти все вхождения домена

В редакторе (VS Code / Cursor):

1. **Поиск по проекту** (Ctrl+Shift+F): введите `yoursite.ru` — откроются все места во фронте. Замените на свой домен (можно через «Заменить все» в нужных файлах).
2. Затем то же для `POKOS_API_BASE`: проверьте, что во всех четырёх HTML задан правильный адрес API.
3. В папке бэкенда в `.env` проверьте наличие `FRONTEND_URL`.

Можно один раз заменить `https://yoursite.ru` на `https://ваш-домен.ru` по всему проекту (только в папке `project`), затем вручную добавить/поправить `window.POKOS_API_BASE` в booking, promo, admin, account.

---

## 5. После выкладки

1. Откройте сайт по домену и проверьте: главная, услуги, бронирование, акции, контакты.
2. Отправьте тестовую заявку с формы бронирования — она должна уйти в ваш бэкенд (и появиться в админке, если она тоже использует этот API).
3. Проверьте страницу акций: блок должен подгружаться с API (адрес задан в `POKOS_API_BASE`).
4. В админке убедитесь, что заявки и акции подгружаются и сохраняются.
5. В поиске (Яндекс/Google) можно отправить ссылку на `sitemap.xml` (например `https://ваш-домен.ru/sitemap.xml`) для ускорения индексации.

Готово: сайт в интернете, все места с доменом и API приведены в порядок по этому чеклисту.
