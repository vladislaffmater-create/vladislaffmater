// Отправка заявок и отзывов в Telegram-бот.
// Важно: вызовы идут напрямую из браузера, поэтому токен будет виден в исходном коде.
// Для продакшена лучше прятать токен на бэкенде, а это оставить как демо.

window.TelegramConfig = {
  TELEGRAM_ENABLED: true, // оставить true, чтобы отправка была активна
  BOT_TOKEN: "8629860725:AAGhe8FYVlNgbsvN4WwQBUs3VFuUUjE8Mxk",
  CHAT_ID: "8499737969", // ID чата, куда слать заявки (можно взять у @userinfobot)
};

function canSendTelegram() {
  const cfg = window.TelegramConfig;
  return (
    cfg &&
    cfg.TELEGRAM_ENABLED &&
    typeof cfg.BOT_TOKEN === "string" &&
    cfg.BOT_TOKEN &&
    typeof cfg.CHAT_ID === "string" &&
    cfg.CHAT_ID
  );
}

function telegramSendMessage(text) {
  const cfg = window.TelegramConfig;
  if (!canSendTelegram()) {
    console.log("[Telegram demo] Message:\n", text);
    return;
  }
  const base = `https://api.telegram.org/bot${encodeURIComponent(
    cfg.BOT_TOKEN
  )}/sendMessage`;
  const url =
    base +
    `?chat_id=${encodeURIComponent(cfg.CHAT_ID)}` +
    `&parse_mode=HTML` +
    `&text=${encodeURIComponent(text)}`;

  console.log("[Telegram] URL:", url);
  const img = new Image();
  img.src = url;
}

window.sendBookingToTelegram = function sendBookingToTelegram(data) {
  const text =
    `<b>Новая заявка на покос</b>\n` +
    `Имя: ${data.fullName || "-"}\n` +
    `Телефон: ${data.phone || "-"}\n` +
    (data.telegram ? `Telegram: ${data.telegram}\n` : "") +
    (data.email ? `Email: ${data.email}\n` : "") +
    `Услуга: ${data.serviceType || "-"}\n` +
    (data.area ? `Площадь: ${data.area} соток\n` : "") +
    (data.slot ? `Дата/время: ${data.slot}\n` : "") +
    (data.address ? `Адрес: ${data.address}\n` : "") +
    (data.comment ? `Комментарий: ${data.comment}\n` : "") +
    `Создано: ${data.createdAt || ""}`;

  telegramSendMessage(text);
};

window.sendReviewToTelegram = function sendReviewToTelegram(data) {
  const text =
    `<b>Новый отзыв</b>\n` +
    `Имя: ${data.name || "-"}\n` +
    `Оценка: ${data.rating || "-"} из 5\n` +
    `Дата: ${data.date || ""}\n` +
    `Текст:\n${data.text || ""}\n` +
    `Создано: ${data.createdAt || ""}`;

  telegramSendMessage(text);
};

window.sendQuestionToTelegram = function sendQuestionToTelegram(data) {
  const text =
    `<b>Новый вопрос с сайта</b>\n` +
    `Имя: ${data.name || "-"}\n` +
    `Телефон или email: ${data.contact || "-"}\n` +
    `Вопрос:\n${data.message || ""}\n` +
    `Создано: ${data.createdAt || ""}`;

  telegramSendMessage(text);
};

