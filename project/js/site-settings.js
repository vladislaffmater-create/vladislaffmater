/**
 * Подставляет контакты из конструктора (localStorage) в шапку и подвал на всех страницах.
 */
(function () {
  const SITE_SETTINGS_KEY = "pokos_site_settings";
  const DEFAULTS = {
    phone: "+7 (900) 000-00-00",
    email: "info@pokos-obninsk.ru",
    telegram: "https://t.me/yourtelegram",
    whatsapp: "79000000000",
  };

  function getSettings() {
    try {
      const raw = localStorage.getItem(SITE_SETTINGS_KEY);
      if (!raw) return DEFAULTS;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? { ...DEFAULTS, ...data } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  }

  function apply() {
    var s = getSettings();
    var phone = s.phone || DEFAULTS.phone;
    var email = s.email || DEFAULTS.email;
    var telegram = s.telegram || DEFAULTS.telegram;
    var whatsappNum = (s.whatsapp || DEFAULTS.whatsapp).replace(/\D/g, "") || "79000000000";
    var whatsappHref = "https://wa.me/" + whatsappNum;

    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.href = "tel:" + phone.replace(/\D/g, "");
      var span = a.querySelector("span");
      if (span) span.textContent = phone;
      else a.textContent = phone;
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.href = "mailto:" + email;
      a.textContent = email;
    });
    document.querySelectorAll('a[href*="t.me"]').forEach(function (a) {
      a.href = telegram.indexOf("http") === 0 ? telegram : "https://t.me/" + telegram.replace(/^@/, "");
      if (!a.querySelector("i")) a.textContent = a.textContent || telegram;
    });
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      a.href = whatsappHref;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
