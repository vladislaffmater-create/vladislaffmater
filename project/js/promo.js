/**
 * Рендер акций на странице promo.html.
 * Сначала загрузка с бэкенда (GET /api/promos), иначе localStorage, иначе дефолтный список.
 */
(function () {
  const PROMOS_KEY = "pokos_promos";
  // Для продакшена задайте в HTML: <script>window.POKOS_API_BASE = "https://ваш-бэкенд.ru";</script> перед подключением promo.js
  const API_BASE = typeof window !== "undefined" && window.POKOS_API_BASE ? window.POKOS_API_BASE : "http://localhost:4000";
  const DEFAULT_PROMOS = [
    { id: "p1", badge: "-10%", title: "Скидка 10% на первый заказ", description: "Для новых клиентов — скидка 10% на первый выезд при заказе от 5 соток. Действует на любые виды покоса.", points: ["Работает для частных и коммерческих клиентов", "Можно сочетать с доп. услугами по стандартной цене"], promoValue: "Скидка 10% на первый заказ" },
    { id: "p2", badge: "Весна", title: "Заказ до 15 мая", description: "При бронировании работ до 15 мая вы получаете выбор: дополнительная скидка 5% или бесплатный вывоз травы.", points: ["Актуально для сезонного первого покоса", "Выбор опции согласуем при подтверждении заказа"], promoValue: "Весенняя акция до 15 мая" },
    { id: "p3", badge: "+5%", title: "Накопительная скидка 5%", description: "После трёх выполненных заказов вы получаете постоянную скидку 5% на все последующие выезды.", points: ["Подходит для дачников и управляющих компаний", "Скидка действует при любой площади участка"], promoValue: "Накопительная скидка 5%" },
    { id: "p4", badge: "-500 ₽", title: "Приведи друга", description: "Рекомендуйте нас знакомым и соседям — за каждого нового клиента вы получаете скидку 500 ₽ на свой следующий заказ.", points: ["Скидки можно суммировать при нескольких рекомендациях", "Акция действует для заказов от 5 соток"], promoValue: "Приведи друга — скидка 500 ₽" },
  ];

  function getPromosFromStorage() {
    try {
      const raw = localStorage.getItem(PROMOS_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) && data.length ? data : null;
    } catch {
      return null;
    }
  }

  function getDefaultPromos() {
    return DEFAULT_PROMOS;
  }

  function renderPromos(promos) {
    var container = document.querySelector(".promo-grid");
    if (!container) return;
    container.innerHTML = "";
    var list = Array.isArray(promos) && promos.length ? promos : getDefaultPromos();
    list.forEach(function (p) {
      if (!p || typeof p !== "object") return;
      var points = Array.isArray(p.points) ? p.points : [];
      var pointsHtml = points.map(function (point) {
        return "<li>" + escapeHtml(point) + "</li>";
      }).join("");
      var card = document.createElement("article");
      card.className = "promo-card";
      var badgeHtml = p.badge ? "<div class=\"promo-badge\">" + escapeHtml(p.badge) + "</div>" : "";
      var titleHtml = "<h2>" + escapeHtml(p.title || "") + "</h2>";
      var descHtml = p.description ? "<p>" + escapeHtml(p.description) + "</p>" : "";
      var pointsBlock = pointsHtml ? "<ul class=\"list-dots\">" + pointsHtml + "</ul>" : "";
      var btnHtml = "<button type=\"button\" class=\"btn btn-primary promo-booking-btn\" data-promo=\"" + escapeHtml(p.promoValue || p.title || "") + "\">Забронировать</button>";
      card.innerHTML = badgeHtml + titleHtml + descHtml + pointsBlock + btnHtml;
      container.appendChild(card);
    });
    var promoButtons = container.querySelectorAll(".promo-booking-btn");
    promoButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var promo = btn.getAttribute("data-promo") || "";
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("pokos_selectedPromo", promo);
        window.location.href = "booking.html";
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getPromosToShow() {
    var fromStorage = getPromosFromStorage();
    return (fromStorage && fromStorage.length) ? fromStorage : getDefaultPromos();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var container = document.querySelector(".promo-grid");
    if (!container) return;

    // Сразу показываем акции (localStorage или дефолт), чтобы блок никогда не был пустым
    renderPromos(getPromosToShow());

    // Затем подгружаем с бэкенда и подменяем, если пришёл непустой список
    fetch(API_BASE + "/api/promos", { method: "GET" })
      .then(function (res) {
        if (!res.ok) return Promise.reject(new Error("HTTP " + res.status));
        return res.json();
      })
      .then(function (data) {
        var list = Array.isArray(data) ? data : null;
        if (list && list.length > 0) renderPromos(list);
      })
      .catch(function () { /* уже отрисовано выше */ });
  });
})();
