(() => {
  const navToggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      nav.classList.toggle("nav-open");
      document.body.classList.toggle("nav-open");
    });

    nav.addEventListener("click", (e) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "A") {
        nav.classList.remove("nav-open");
        document.body.classList.remove("nav-open");
      }
    });
  }

  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  // Маска телефона +7 (XXX) XXX-XX-XX
  function formatPhone(value) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";

    let numbers = digits;
    if (numbers[0] === "8") {
      numbers = "7" + numbers.slice(1);
    }
    if (numbers[0] !== "7") {
      numbers = "7" + numbers;
    }

    let result = "+7";

    if (numbers.length > 1) {
      result += " (" + numbers.slice(1, 4);
      if (numbers.length >= 4) {
        result += ")";
      }
    }

    if (numbers.length >= 5) {
      result += " " + numbers.slice(4, 7);
    }

    if (numbers.length >= 8) {
      result += "-" + numbers.slice(7, 9);
    }

    if (numbers.length >= 10) {
      result += "-" + numbers.slice(9, 11);
    }

    return result;
  }

  function setupPhoneMasks() {
    const phoneInputs = document.querySelectorAll(
      'input[data-phone-mask="true"]'
    );

    phoneInputs.forEach((input) => {
      let lastFormattedValue = "";

      input.addEventListener("input", () => {
        const userValue = input.value;
        const prevDigits = lastFormattedValue.replace(/\D/g, "");
        const newDigits = userValue.replace(/\D/g, "");

        // Стирание: пользователь удалил символ, но цифры те же — удалил скобку/пробел/дефис
        const wasDeletion = userValue.length < lastFormattedValue.length;
        if (wasDeletion && newDigits === prevDigits && prevDigits.length > 0) {
          input.value = formatPhone(prevDigits.slice(0, -1));
          lastFormattedValue = input.value;
          input.setSelectionRange(input.value.length, input.value.length);
          return;
        }

        const prevLen = input.value.length;
        const prevPos = input.selectionStart || 0;
        input.value = formatPhone(userValue);
        lastFormattedValue = input.value;
        const newLen = input.value.length;
        const diff = newLen - prevLen;
        const newPos = Math.max(0, Math.min(prevPos + diff, input.value.length));
        input.setSelectionRange(newPos, newPos);
      });

      input.addEventListener("keydown", (e) => {
        const pos = input.selectionStart || 0;
        const val = input.value;
        const digits = val.replace(/\D/g, "");

        if (e.key === "Backspace" && pos === val.length && digits.length > 1) {
          const digitIndex = val.replace(/\D/g, "").length - 1;
          const newDigits = digits.slice(0, digitIndex);
          e.preventDefault();
          input.value = formatPhone(newDigits);
          lastFormattedValue = input.value;
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });

      input.addEventListener("blur", () => {
        const digits = input.value.replace(/\D/g, "");
        if (digits && digits.length < 11) {
          window.showToast("Введите полный номер телефона.", "error");
          input.value = "";
          lastFormattedValue = "";
        } else {
          lastFormattedValue = input.value;
        }
      });
    });
  }

  function isValidEmail(value) {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(trimmed);
  }

  window.showToast = function showToast(message, type = "success", timeout = 3200) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button type="button" aria-label="Закрыть уведомление">&times;</button>
    `;

    const close = () => {
      toast.style.animation = "toast-out 0.2s ease-in forwards";
      setTimeout(() => toast.remove(), 180);
    };

    toast.querySelector("button")?.addEventListener("click", close);
    container.appendChild(toast);
    setTimeout(close, timeout);
  };

  const quickRequestForm = document.getElementById("quickRequestForm");
  if (quickRequestForm) {
    // Блок быстрой заявки больше не используется: форма оставлена на случай старого HTML,
    // но обработчик отключён, чтобы заявки шли только через страницу бронирования.
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Подключаем маску телефона на всех страницах
    setupPhoneMasks();

    const homeReviews = document.getElementById("homeReviews");
    if (homeReviews && window.getLatestReviews) {
      const latest = window.getLatestReviews(3);
      latest.forEach((rev) => {
        const card = document.createElement("article");
        card.className = "review-card";
        card.innerHTML = `
          <div class="review-header">
            <div>
              <div class="review-name">${rev.name}</div>
              <div class="review-date">${rev.date}</div>
            </div>
            <div class="review-rating">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</div>
          </div>
          <div class="review-text">${rev.text}</div>
        `;
        homeReviews.appendChild(card);
      });
    }

    const promoButtons = document.querySelectorAll(".promo-booking-btn");
    promoButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const promo = btn.getAttribute("data-promo") || "";
        sessionStorage.setItem("pokos_selectedPromo", promo);
        window.location.href = "booking.html";
      });
    });

    // Форма вопросов на странице контактов: валидация + отправка в Telegram
    const questionForm = document.getElementById("questionForm");
    if (questionForm) {
      questionForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("qName");
        const contactInput = document.getElementById("qContact");
        const messageInput = document.getElementById("qMessage");

        if (
          !nameInput.value.trim() ||
          !contactInput.value.trim() ||
          !messageInput.value.trim()
        ) {
          window.showToast("Заполните все обязательные поля.", "error");
          return;
        }

        const contact = contactInput.value.trim();
        if (contact.includes("@")) {
          if (!isValidEmail(contact)) {
            window.showToast("Введите корректный email (должны быть @ и точка).", "error");
            contactInput.focus();
            return;
          }
        }

        const data = {
          name: nameInput.value.trim(),
          contact: contact,
          message: messageInput.value.trim(),
          createdAt: new Date().toLocaleString("ru-RU"),
        };

        if (window.sendQuestionToTelegram) {
          window.sendQuestionToTelegram(data);
        }

        questionForm.reset();
        window.showToast("Вопрос отправлен. Мы ответим в течение рабочего дня.", "success");
      });
    }
  });
})();

