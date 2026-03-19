(() => {
  const API_BASE = typeof window !== "undefined" && window.POKOS_API_BASE ? window.POKOS_API_BASE : "http://localhost:4000";

  function getCurrentUserId() {
    try {
      const raw = localStorage.getItem("pokos_user");
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user && user.id != null ? user.id : null;
    } catch {
      return null;
    }
  }

  async function sendBookingToApi(data) {
    const body = {
      fullName: data.fullName,
      phone: data.phone,
      serviceType: data.serviceType,
      slot: data.slot,
      address: data.address,
      comment: data.comment || null,
      area: data.area ? Number(data.area) || null : null,
      userId: getCurrentUserId(),
      source: data.source || null,
    };
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Ошибка отправки заявки");
    }
    return res.json();
  }

  function safeParseBookingPayload() {
    try {
      const raw = sessionStorage.getItem("pokos_bookingFromCalc");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function safeParsePromo() {
    try {
      return sessionStorage.getItem("pokos_selectedPromo");
    } catch {
      return null;
    }
  }

  function saveBookingToStorage(data) {
    try {
      const raw = localStorage.getItem("pokos_bookings") || "[]";
      const list = JSON.parse(raw);
      list.push(data);
      localStorage.setItem("pokos_bookings", JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const slotInput = document.getElementById("slot");
    const areaInput = document.getElementById("area");
    const commentInput = document.getElementById("comment");

    if (window.flatpickr && slotInput) {
      window.flatpickr("#datePicker", {
        enableTime: true,
        time_24hr: true,
        minDate: "today",
        locale: window.flatpickr.l10ns.ru,
        minuteIncrement: 60,
        defaultHour: 10,
        dateFormat: "d.m.Y H:i",
        onChange: (selectedDates, dateStr) => {
          if (slotInput) {
            slotInput.value = dateStr;
          }
        },
      });
    }

    const calcData = safeParseBookingPayload();
    if (calcData && areaInput) {
      if (calcData.area) {
        areaInput.value = calcData.area;
      }
      if (calcData.price && commentInput) {
        const txt = commentInput.value || "";
        const priceInfo = `Ориентировочная стоимость по калькулятору: ${calcData.price} ₽. `;
        if (!txt.includes("Ориентировочная стоимость")) {
          commentInput.value = priceInfo + txt;
        }
      }
    }

    const promo = safeParsePromo();
    if (promo && commentInput) {
      const txt = commentInput.value || "";
      const promoLine = `Акция: ${promo}. `;
      if (!txt.includes("Акция:")) {
        commentInput.value = promoLine + txt;
      }
    }

    const bigAreaNote = document.getElementById("bigAreaNote");
    if (areaInput && bigAreaNote) {
      const handler = () => {
        const val = Number(areaInput.value || 0);
        bigAreaNote.hidden = !(val && val > 20);
      };
      areaInput.addEventListener("input", handler);
      handler();
    }

    const form = document.getElementById("bookingForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const fullName = document.getElementById("fullName");
      const phone = document.getElementById("phone");
      const address = document.getElementById("address");
      const serviceType = document.getElementById("serviceType");
      const slot = document.getElementById("slot");
      const emailInput = document.getElementById("email");

      if (!fullName.value.trim() || !phone.value.trim() || !address.value.trim() || !serviceType.value || !slot.value.trim()) {
        window.showToast("Пожалуйста, заполните обязательные поля.", "error");
        return;
      }

      // Если email указан — проверяем, что он содержит @ и точку
      const emailValue = emailInput ? emailInput.value.trim() : "";
      if (emailValue) {
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
        if (!emailValid) {
          window.showToast("Введите корректный email (должны быть @ и точка).", "error");
          emailInput.focus();
          return;
        }
      }

      const data = {
        fullName: fullName.value.trim(),
        phone: phone.value.trim(),
        email: emailValue,
        telegram: document.getElementById("telegram").value.trim(),
        address: address.value.trim(),
        serviceType: serviceType.value,
        area: areaInput ? areaInput.value : "",
        comment: commentInput ? commentInput.value.trim() : "",
        slot: slot.value.trim(),
        createdAt: new Date().toISOString(),
        // источник заявки для аналитики в админке
        source: promo
          ? "Акции"
          : "Онлайн‑бронь",
      };

      saveBookingToStorage(data);
      if (window.sendBookingToTelegram) {
        window.sendBookingToTelegram(data);
      }

      (async () => {
        try {
          await sendBookingToApi(data);
          window.showToast("Заявка принята! Мы свяжемся с вами для подтверждения.", "success");
        } catch (err) {
          window.showToast("Заявка отправлена в Telegram. В базу не сохранена — запустите backend (npm start в backend-pokos).", "error");
        }
        form.reset();
        if (slotInput) slotInput.value = "";
        if (bigAreaNote) bigAreaNote.hidden = true;
      })();
    });
  });
})();

