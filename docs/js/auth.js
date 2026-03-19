(() => {
  const API_BASE = typeof window !== "undefined" && window.POKOS_API_BASE ? window.POKOS_API_BASE : "http://localhost:4000";

  function getToken() {
    try {
      return localStorage.getItem("pokos_token") || null;
    } catch {
      return null;
    }
  }

  function saveAuth(token, user) {
    try {
      localStorage.setItem("pokos_token", token);
      localStorage.setItem("pokos_user", JSON.stringify(user));
    } catch {
      // ignore
    }
  }

  function clearAuth() {
    try {
      localStorage.removeItem("pokos_token");
      localStorage.removeItem("pokos_user");
    } catch {
      // ignore
    }
  }

  async function apiRequest(path, options = {}) {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new Error("Сервер недоступен. Запустите backend: в папке backend-pokos выполните npm start.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Ошибка запроса к серверу";
      throw new Error(message);
    }
    return data;
  }

  async function loadAccountData() {
    const accountSection = document.getElementById("accountSection");
    const bookingsTableBody = document.querySelector(
      "#accountBookingsTable tbody"
    );
    const emptyNote = document.getElementById("accountBookingsEmpty");

    try {
      const [me, bookings] = await Promise.all([
        apiRequest("/api/me"),
        apiRequest("/api/my-bookings"),
      ]);

      if (me) {
        const emailEl = document.getElementById("accountEmail");
        const nameEl = document.getElementById("accountName");
        const phoneEl = document.getElementById("accountPhone");
        const levelEl = document.getElementById("loyaltyLevel");
        const pointsEl = document.getElementById("loyaltyPoints");
        const ordersEl = document.getElementById("loyaltyOrders");

        emailEl.textContent = `Email: ${me.email || "-"}`;
        nameEl.textContent = `Имя: ${me.full_name || "не указано"}`;
        phoneEl.textContent = `Телефон: ${me.phone || "не указан"}`;

        levelEl.textContent = `Уровень: ${me.level || "bronze"}`;
        pointsEl.textContent = `Бонусные баллы: ${me.points ?? 0}`;
        ordersEl.textContent = `Всего заказов: ${me.total_orders ?? 0}`;
      }

      if (bookingsTableBody) {
        bookingsTableBody.innerHTML = "";
        if (!bookings || bookings.length === 0) {
          if (emptyNote) emptyNote.style.display = "block";
        } else {
          if (emptyNote) emptyNote.style.display = "none";
          bookings.forEach((b) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${b.created_at || ""}</td>
              <td>${b.service_type || ""}</td>
              <td>${b.area || ""}</td>
              <td>${b.slot || ""}</td>
              <td>${b.address || ""}</td>
              <td>${b.status || ""}</td>
            `;
            bookingsTableBody.appendChild(tr);
          });
        }
      }

      if (accountSection) {
        accountSection.style.display = "";
      }
    } catch (e) {
      console.error(e);
      window.showToast(
        e.message || "Не удалось загрузить данные личного кабинета.",
        "error"
      );
    }
  }

  async function checkBackendAvailable() {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  function showBackendUnavailableBanner() {
    const authSection = document.getElementById("authSection");
    if (!authSection) return;
    let banner = document.getElementById("authBackendBanner");
    if (banner) return;
    banner = document.createElement("div");
    banner.id = "authBackendBanner";
    banner.style.cssText = "background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:0.9rem;";
    banner.innerHTML = "Сервер недоступен. Чтобы вход и регистрация работали, запустите backend: в папке <strong>backend-pokos</strong> выполните <strong>npm start</strong>. Убедитесь, что PostgreSQL тоже запущен.";
    authSection.insertBefore(banner, authSection.firstChild);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const authSection = document.getElementById("authSection");
    const accountSection = document.getElementById("accountSection");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!authSection || !accountSection) return;

    const backendOk = await checkBackendAvailable();
    if (!backendOk) showBackendUnavailableBanner();

    const token = getToken();
    if (token) {
      authSection.style.display = "none";
      accountSection.style.display = "";
      loadAccountData();
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document
          .getElementById("loginPassword")
          .value.trim();

        if (!email || !password) {
          window.showToast("Введите email и пароль.", "error");
          return;
        }

        try {
          const data = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          saveAuth(data.token, data.user);
          window.showToast("Вы успешно вошли в личный кабинет.", "success");
          authSection.style.display = "none";
          accountSection.style.display = "";
          loadAccountData();
        } catch (err) {
          window.showToast(err.message || "Ошибка входа.", "error");
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value.trim();
        const fullName = document.getElementById("regFullName").value.trim();
        const phone = document.getElementById("regPhone").value.trim();

        if (!email || !password) {
          window.showToast("Заполните email и пароль.", "error");
          return;
        }
        if (password.length < 6) {
          window.showToast("Пароль должен быть не короче 6 символов.", "error");
          return;
        }

        try {
          const data = await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, fullName, phone }),
          });
          saveAuth(data.token, data.user);
          window.showToast("Регистрация успешна. Вы вошли в личный кабинет.", "success");
          authSection.style.display = "none";
          accountSection.style.display = "";
          loadAccountData();
        } catch (err) {
          window.showToast(err.message || "Ошибка регистрации.", "error");
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearAuth();
        window.showToast("Вы вышли из личного кабинета.", "success");
        accountSection.style.display = "none";
        authSection.style.display = "";
      });
    }
  });
})();

