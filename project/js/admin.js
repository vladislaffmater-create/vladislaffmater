(() => {
  const BOOKINGS_KEY = "pokos_bookings";
  const REVIEWS_KEY = "pokos_reviews";
  const PROMOS_KEY = "pokos_promos";
  const SITE_SETTINGS_KEY = "pokos_site_settings";
  const API_BASE = typeof window !== "undefined" && window.POKOS_API_BASE ? window.POKOS_API_BASE : "http://localhost:4000";
  /** Ключ для сохранения акций через PUT /api/promos (если в backend задан ADMIN_SECRET). */
  const ADMIN_KEY = "";

  const DEFAULT_PROMOS = [
    { id: "p1", badge: "-10%", title: "Скидка 10% на первый заказ", description: "Для новых клиентов — скидка 10% на первый выезд при заказе от 5 соток. Действует на любые виды покоса.", points: ["Работает для частных и коммерческих клиентов", "Можно сочетать с доп. услугами по стандартной цене"], promoValue: "Скидка 10% на первый заказ" },
    { id: "p2", badge: "Весна", title: "Заказ до 15 мая", description: "При бронировании работ до 15 мая вы получаете выбор: дополнительная скидка 5% или бесплатный вывоз травы.", points: ["Актуально для сезонного первого покоса", "Выбор опции согласуем при подтверждении заказа"], promoValue: "Весенняя акция до 15 мая" },
    { id: "p3", badge: "+5%", title: "Накопительная скидка 5%", description: "После трёх выполненных заказов вы получаете постоянную скидку 5% на все последующие выезды.", points: ["Подходит для дачников и управляющих компаний", "Скидка действует при любой площади участка"], promoValue: "Накопительная скидка 5%" },
    { id: "p4", badge: "-500 ₽", title: "Приведи друга", description: "Рекомендуйте нас знакомым и соседям — за каждого нового клиента вы получаете скидку 500 ₽ на свой следующий заказ.", points: ["Скидки можно суммировать при нескольких рекомендациях", "Акция действует для заказов от 5 соток"], promoValue: "Приведи друга — скидка 500 ₽" },
  ];

  const ADMIN_LOGIN = "admin";
  const ADMIN_PASSWORD = "pokos123";

  function isAdminAuthenticated() {
    try {
      return sessionStorage.getItem("pokos_admin_auth") === "1";
    } catch {
      return false;
    }
  }

  function setAdminAuthenticated() {
    try {
      sessionStorage.setItem("pokos_admin_auth", "1");
    } catch {
      // ignore
    }
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function loadObject(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback || {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : (fallback || {});
    } catch {
      return fallback || {};
    }
  }

  function saveObject(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function normalizeBooking(b) {
    const created = b.created_at || b.createdAt;
    return {
      id: b.id,
      created_at: created,
      fullName: b.full_name || b.fullName,
      phone: b.phone,
      serviceType: b.service_type || b.serviceType,
      area: b.area,
      slot: b.slot,
      address: b.address,
      comment: b.comment,
      status: b.status || "new",
      adminComment: b.admin_comment || b.adminComment || "",
      source: b.source || b.source_type || b.sourceType || "",
    };
  }

  /** Нормализует номер для поиска: только цифры, код 8 (как в БД). +7 и 8 — один формат. */
  function normalizePhoneForSearch(phone) {
    if (!phone) return "";
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "7") {
      return "8" + digits.slice(1);
    }
    if (digits.length === 10 && /^[79]\d{9}$/.test(digits)) {
      return "8" + digits;
    }
    return digits;
  }

  /** Нормализует поисковый запрос по номеру: к формату 8 (как в БД). */
  function normalizeSearchPhone(query) {
    const digits = (query || "").replace(/\D/g, "");
    if (digits.length >= 1 && digits.charAt(0) === "7") {
      return "8" + digits.slice(1);
    }
    return digits;
  }

  function filterBookings(list, search, dateFrom, dateTo, statusFilter) {
    let out = [...list];
    const q = (search || "").trim().toLowerCase();
    const qDigits = normalizeSearchPhone(q);
    if (q) {
      out = out.filter((b) => {
        const matchName = b.fullName && b.fullName.toLowerCase().includes(q);
        const phoneNorm = normalizePhoneForSearch(b.phone);
        const matchPhone = qDigits && phoneNorm && (phoneNorm.includes(qDigits) || (b.phone && b.phone.toLowerCase().includes(q)));
        return matchName || matchPhone;
      });
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      out = out.filter((b) => new Date(b.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      out = out.filter((b) => new Date(b.created_at) <= to);
    }
    if (statusFilter) {
      out = out.filter((b) => {
        const raw = (b.status || "new").toString().toLowerCase();
        const wanted = statusFilter.toString().toLowerCase();
        if (wanted === "new" || wanted === "новая") {
          return raw === "new" || raw === "новая";
        }
        return raw === wanted;
      });
    }
    return out;
  }

  let adminBookingsRaw = [];
  let adminBookingsFromApi = false;

  /** Определяет источник заявки для аналитики. */
  function detectBookingSource(b) {
    const explicit = (b.source || "").toString().trim();
    if (explicit) return explicit;

    const comment = (b.comment || "").toString().toLowerCase();
    if (comment.includes("акция:")) return "Акции";
    if (comment.includes("ориентировочная стоимость по калькулятору")) {
      return "Онлайн‑бронь";
    }
    return "Онлайн‑бронь";
  }

  function getStatusValueForSelect(status) {
    const raw = (status || "new").toString().toLowerCase();
    if (raw === "new" || raw === "новая") return "новая";
    if (raw === "обработано") return "обработано";
    if (raw === "не дозвонились") return "не дозвонились";
    if (raw === "просили перезвонить") return "просили перезвонить";
    return "новая";
  }

  function buildStatusSelectHtml(id, statusValue, canChangeStatus) {
    const disabledAttr = canChangeStatus
      ? ""
      : 'disabled title="Запустите backend для смены статуса и сохранения комментариев"';
    return `<select class="admin-status-select" data-id="${id || ""}" ${disabledAttr}>
      <option value="новая" ${statusValue === "новая" ? "selected" : ""}>Новая</option>
      <option value="обработано" ${statusValue === "обработано" ? "selected" : ""}>Обработано</option>
      <option value="не дозвонились" ${statusValue === "не дозвонились" ? "selected" : ""}>Не дозвонились</option>
      <option value="просили перезвонить" ${statusValue === "просили перезвонить" ? "selected" : ""}>Просили перезвонить</option>
    </select>`;
  }

  function renderBookingsTable(bookings, tableBody, emptyNote) {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    if (!bookings.length) {
      if (emptyNote) emptyNote.style.display = "block";
      return;
    }
    if (emptyNote) emptyNote.style.display = "none";
    const sorted = [...bookings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sorted.forEach((b) => {
      const tr = document.createElement("tr");
      const statusValue = getStatusValueForSelect(b.status);
      const canChangeStatus = adminBookingsFromApi && b.id;
      const selectHtml = buildStatusSelectHtml(b.id, statusValue, canChangeStatus);
      tr.innerHTML = `
        <td>${formatDateTime(b.created_at)}</td>
        <td>${b.fullName || ""}</td>
        <td>${b.phone || ""}</td>
        <td>${b.serviceType || ""}</td>
        <td>${b.area ?? ""}</td>
        <td>${b.slot || ""}</td>
        <td>${b.address || ""}</td>
        <td>${b.comment || ""}</td>
        <td>${selectHtml}</td>
        <td>
          <textarea
            class="admin-comment-input"
            data-id="${b.id || ""}"
            rows="2"
            placeholder="Комментарий администратора"
            ${canChangeStatus ? "" : 'disabled'}
          ></textarea>
        </td>
      `;
      const commentEl = tr.querySelector(".admin-comment-input");
      if (commentEl && b.adminComment) {
        commentEl.value = b.adminComment;
      }
      tableBody.appendChild(tr);
    });
  }

  async function updateBookingStatus(id, newStatus) {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      if (window.showToast) window.showToast("Статус обновлён.", "success");
      await loadBookings();
      applyBookingsFilters();
    } catch {
      if (window.showToast) window.showToast("Не удалось обновить статус. Запустите backend.", "error");
    }
  }

  async function updateBookingAdminComment(id, newComment) {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminComment: newComment }),
      });
      if (!res.ok) throw new Error();
      if (window.showToast) window.showToast("Комментарий сохранён.", "success");
      await loadBookings();
      applyBookingsFilters();
    } catch {
      if (window.showToast) window.showToast("Не удалось сохранить комментарий. Запустите backend.", "error");
    }
  }

  function getCurrentBookingFilters() {
    const search = document.getElementById("bookingsSearch");
    const dateFrom = document.getElementById("bookingsDateFrom");
    const dateTo = document.getElementById("bookingsDateTo");
    const statusFilter = document.getElementById("bookingsStatusFilter");
    return {
      search: search ? search.value : "",
      dateFrom: dateFrom ? dateFrom.value : "",
      dateTo: dateTo ? dateTo.value : "",
      statusFilter: statusFilter ? statusFilter.value : "",
    };
  }

  function getFilteredBookings() {
    const { search, dateFrom, dateTo, statusFilter } = getCurrentBookingFilters();
    return filterBookings(adminBookingsRaw, search, dateFrom, dateTo, statusFilter);
  }

  function applyBookingsFilters() {
    const filtered = getFilteredBookings();
    renderBookingsTable(
      filtered,
      document.querySelector("#bookingsTable tbody"),
      document.getElementById("bookingsEmptyNote")
    );
  }

  async function loadBookings() {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`);
      if (res.ok) {
        const data = await res.json();
        adminBookingsRaw = (data || []).map(normalizeBooking);
        adminBookingsFromApi = true;
        return;
      }
    } catch {
      // fallback to localStorage
    }
    const local = loadJson(BOOKINGS_KEY, []);
    adminBookingsRaw = local.map((b) => ({
      ...normalizeBooking({
        ...b,
        created_at: b.createdAt,
        full_name: b.fullName,
        service_type: b.serviceType,
        source: b.source,
      }),
      id: null,
      adminComment: "",
    }));
    adminBookingsFromApi = false;
  }

  function formatStatusForStats(status) {
    const raw = (status || "new").toString().toLowerCase();
    if (raw === "new" || raw === "новая") return "новая";
    if (raw === "обработано") return "обработано";
    if (raw === "не дозвонились") return "не дозвонились";
    if (raw === "просили перезвонить") return "просили перезвонить";
    return raw;
  }

  function updateBookingsStatsAndChart() {
    const totalEl = document.getElementById("statTotalBookings");
    const newEl = document.getElementById("statNewBookings");
    const doneEl = document.getElementById("statDoneBookings");
    const noAnswerEl = document.getElementById("statNoAnswerBookings");
    const recallEl = document.getElementById("statRecallBookings");
    const areaEl = document.getElementById("statTotalArea");
    const chartEl = document.getElementById("bookingsChart");

    const list = getFilteredBookings();

    const total = list.length;
    let totalArea = 0;
    let countNew = 0;
    let countDone = 0;
    let countNoAnswer = 0;
    let countRecall = 0;

    const servicesCount = {};
    const servicesArea = {};

    const now = new Date();
    const days = [];
    const countsByDate = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
      days.push({ key, label });
      countsByDate[key] = {
        total: 0,
        new: 0,
        done: 0,
        noAnswer: 0,
        recall: 0,
      };
    }

    list.forEach((b) => {
      const areaVal = b.area != null && !isNaN(Number(b.area)) ? Number(b.area) : 0;
      if (areaVal) {
        totalArea += areaVal;
      }

      const st = formatStatusForStats(b.status);
      if (st === "новая") countNew++;
      else if (st === "обработано") countDone++;
      else if (st === "не дозвонились") countNoAnswer++;
      else if (st === "просили перезвонить") countRecall++;

      const serviceKey = (b.serviceType || "Без указания услуги").toString().trim();
      if (!servicesCount[serviceKey]) {
        servicesCount[serviceKey] = 0;
        servicesArea[serviceKey] = 0;
      }
      servicesCount[serviceKey] += 1;
      servicesArea[serviceKey] += areaVal;

      if (b.created_at) {
        const d = new Date(b.created_at);
        if (!isNaN(d.getTime())) {
          const key = d.toISOString().slice(0, 10);
          if (Object.prototype.hasOwnProperty.call(countsByDate, key)) {
            const bucket = countsByDate[key];
            bucket.total += 1;
            if (st === "новая") bucket.new += 1;
            else if (st === "обработано") bucket.done += 1;
            else if (st === "не дозвонились") bucket.noAnswer += 1;
            else if (st === "просили перезвонить") bucket.recall += 1;
          }
        }
      }
    });

    if (totalEl) totalEl.textContent = String(total);
    if (newEl) newEl.textContent = String(countNew);
    if (doneEl) doneEl.textContent = String(countDone);
    if (noAnswerEl) noAnswerEl.textContent = String(countNoAnswer);
    if (recallEl) recallEl.textContent = String(countRecall);
    if (areaEl) areaEl.textContent = totalArea ? String(Math.round(totalArea * 10) / 10) : "0";

    if (chartEl) {
      chartEl.innerHTML = "";
      const totals = days.map((d) => countsByDate[d.key].total || 0);
      const maxTotal = Math.max(...totals, 1);
      days.forEach((d) => {
        const bucket = countsByDate[d.key];
        const totalForDay = bucket.total || 0;

        const bar = document.createElement("div");
        bar.className = "admin-chart-bar";

        const stack = document.createElement("div");
        stack.className = "admin-chart-bar-stack";

        const addSegment = (value, className) => {
          const seg = document.createElement("div");
          seg.className = `admin-chart-segment ${className}`;
          const height =
            totalForDay && maxTotal
              ? (value / maxTotal) * 100
              : 0;
          seg.style.height = `${height}%`;
          stack.appendChild(seg);
        };

        addSegment(bucket.new, "segment-new");
        addSegment(bucket.done, "segment-done");
        addSegment(bucket.noAnswer, "segment-noanswer");
        addSegment(bucket.recall, "segment-recall");

        const valueLabel = document.createElement("div");
        valueLabel.className = "admin-chart-value";
        valueLabel.textContent = totalForDay ? String(totalForDay) : "";

        const label = document.createElement("div");
        label.className = "admin-chart-label";
        label.textContent = d.label;

        bar.appendChild(stack);
        bar.appendChild(valueLabel);
        bar.appendChild(label);
        chartEl.appendChild(bar);
      });
    }

    const topServicesList = document.getElementById("topServicesList");
    if (topServicesList) {
      topServicesList.innerHTML = "";
      const entries = Object.entries(servicesCount);
      if (!entries.length) {
        const li = document.createElement("li");
        li.textContent = "Нет заявок за выбранный период.";
        topServicesList.appendChild(li);
      } else {
        entries
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .forEach(([name, count]) => {
            const area = servicesArea[name] || 0;
            const li = document.createElement("li");
            li.innerHTML = `<span class="admin-analytics-name">${name}</span><span class="admin-analytics-meta">${count} заявк${count === 1 ? "а" : count >= 2 && count <= 4 ? "и" : "ов"}, ~${Math.round(area * 10) / 10} сот.</span>`;
            topServicesList.appendChild(li);
          });
      }
    }

  }

  function initConstructor() {
    const promosList = document.getElementById("promosList");
    const promoModal = document.getElementById("promoModal");
    const constructorTabs = document.querySelectorAll(".constructor-tab");
    const panelPromos = document.getElementById("constructorPromos");
    const panelContacts = document.getElementById("constructorContacts");
    const contactsForm = document.getElementById("constructorContactsForm");

    constructorTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        constructorTabs.forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        const name = tab.getAttribute("data-tab");
        panelPromos.style.display = name === "promos" ? "block" : "none";
        panelContacts.style.display = name === "contacts" ? "block" : "none";
        if (name === "promos") loadPromosFromApiAndRender();
      });
    });

    /** Загружает акции с бэкенда в localStorage и обновляет список в конструкторе. */
    function loadPromosFromApiAndRender() {
      renderPromosList(); // сразу показываем то, что есть (localStorage или дефолт)
      fetch(API_BASE + "/api/promos", { method: "GET" })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            saveJson(PROMOS_KEY, list);
            renderPromosList();
          }
        })
        .catch(() => { /* уже отрисовано выше */ });
    }

    loadPromosFromApiAndRender();

    function getPromos() {
      let list;
      try {
        const raw = loadJson(PROMOS_KEY, []);
        list = Array.isArray(raw) ? raw : [];
      } catch {
        list = [];
      }
      if (!list.length) {
        saveJson(PROMOS_KEY, DEFAULT_PROMOS);
        list = DEFAULT_PROMOS.slice();
      }
      return list;
    }

    function renderPromosList() {
      if (!promosList) return;
      const list = getPromos();
      promosList.innerHTML = "";
      (Array.isArray(list) ? list : []).forEach((p) => {
        if (!p || typeof p !== "object") return;
        const card = document.createElement("div");
        card.className = "constructor-promo-card";
        card.innerHTML = `
          <div>
            <h4>${(p.title || "").replace(/</g, "&lt;")}</h4>
            <div class="promo-meta">Бейдж: ${(p.badge || "").replace(/</g, "&lt;")} · ${(p.points && p.points.length) ? p.points.length + " п." : "0 п."}</div>
          </div>
          <div class="promo-actions">
            <button type="button" class="btn btn-outline btn-xs constructor-edit-promo" data-id="${(p.id || "").replace(/"/g, "&quot;")}">Изменить</button>
            <button type="button" class="btn btn-ghost btn-xs constructor-delete-promo" data-id="${(p.id || "").replace(/"/g, "&quot;")}">Удалить</button>
          </div>
        `;
        promosList.appendChild(card);
      });
    }

    function openPromoModal(promo) {
      document.getElementById("promoEditId").value = promo ? promo.id : "";
      document.getElementById("promoBadge").value = promo ? (promo.badge || "") : "";
      document.getElementById("promoTitle").value = promo ? (promo.title || "") : "";
      document.getElementById("promoDescription").value = promo ? (promo.description || "") : "";
      document.getElementById("promoPoints").value = promo && promo.points && Array.isArray(promo.points) ? promo.points.join("\n") : "";
      document.getElementById("promoButtonValue").value = promo ? (promo.promoValue || promo.title || "") : "";
      promoModal.style.display = "flex";
    }

    function closePromoModal() {
      promoModal.style.display = "none";
    }

    document.getElementById("constructorAddPromo")?.addEventListener("click", () => {
      openPromoModal(null);
    });

    promoModal?.querySelector(".constructor-modal-backdrop")?.addEventListener("click", closePromoModal);
    document.getElementById("promoModalCancel")?.addEventListener("click", closePromoModal);

    document.getElementById("promoModalSave")?.addEventListener("click", () => {
      const id = document.getElementById("promoEditId").value.trim();
      const badge = document.getElementById("promoBadge").value.trim();
      const title = document.getElementById("promoTitle").value.trim();
      const description = document.getElementById("promoDescription").value.trim();
      const pointsText = document.getElementById("promoPoints").value.trim();
      const promoValue = document.getElementById("promoButtonValue").value.trim();
      const points = pointsText ? pointsText.split("\n").map((s) => s.trim()).filter(Boolean) : [];
      if (!title) {
        if (window.showToast) window.showToast("Заполните заголовок акции.", "error");
        return;
      }
      const list = getPromos();
      if (id) {
        const idx = list.findIndex((p) => String(p.id) === String(id));
        if (idx !== -1) {
          list[idx] = { ...list[idx], badge, title, description, points, promoValue: promoValue || title };
        }
      } else {
        const newId = "p-" + Date.now();
        list.push({ id: newId, badge, title, description, points, promoValue: promoValue || title });
      }
      saveJson(PROMOS_KEY, list);
      renderPromosList();
      closePromoModal();
      const headers = { "Content-Type": "application/json" };
      if (ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;
      fetch(API_BASE + "/api/promos", { method: "PUT", headers, body: JSON.stringify(list) })
        .then((res) => {
          if (res.ok) {
            if (window.showToast) window.showToast("Акция сохранена (сайт и бэкенд).", "success");
            return;
          }
          return res.json().then((j) => Promise.reject(j));
        })
        .catch(() => {
          if (window.showToast) window.showToast("Акция сохранена локально. Запустите backend, чтобы они отображались на сайте.", "warning");
        });
    });

    promosList?.addEventListener("click", (e) => {
      const target = e.target;
      if (!target.matches(".constructor-edit-promo") && !target.matches(".constructor-delete-promo")) return;
      const id = target.getAttribute("data-id");
      const list = getPromos();
      const promo = list.find((p) => String(p.id) === String(id));
      if (target.matches(".constructor-edit-promo") && promo) openPromoModal(promo);
      if (target.matches(".constructor-delete-promo") && promo && window.confirm("Удалить эту акцию?")) {
        const next = list.filter((p) => String(p.id) !== String(id));
        saveJson(PROMOS_KEY, next);
        renderPromosList();
        const headers = { "Content-Type": "application/json" };
        if (ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;
        fetch(API_BASE + "/api/promos", { method: "PUT", headers, body: JSON.stringify(next) })
          .then((res) => { if (res.ok && window.showToast) window.showToast("Акция удалена (сайт и бэкенд).", "success"); })
          .catch(() => { if (window.showToast) window.showToast("Акция удалена локально. Запустите backend для синхронизации.", "warning"); });
      }
    });

    const defaultsContacts = { phone: "+7 (900) 000-00-00", email: "info@pokos-obninsk.ru", telegram: "https://t.me/yourtelegram", whatsapp: "79000000000" };
    function loadContactsIntoForm() {
      const s = loadObject(SITE_SETTINGS_KEY, defaultsContacts);
      if (document.getElementById("sitePhone")) document.getElementById("sitePhone").value = s.phone || "";
      if (document.getElementById("siteEmail")) document.getElementById("siteEmail").value = s.email || "";
      if (document.getElementById("siteTelegram")) document.getElementById("siteTelegram").value = s.telegram || "";
      if (document.getElementById("siteWhatsapp")) document.getElementById("siteWhatsapp").value = s.whatsapp || "";
    }
    loadContactsIntoForm();

    contactsForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = document.getElementById("sitePhone")?.value?.trim() || defaultsContacts.phone;
      const email = document.getElementById("siteEmail")?.value?.trim() || defaultsContacts.email;
      const telegram = document.getElementById("siteTelegram")?.value?.trim() || defaultsContacts.telegram;
      const whatsapp = (document.getElementById("siteWhatsapp")?.value?.trim() || defaultsContacts.whatsapp).replace(/\D/g, "");
      saveObject(SITE_SETTINGS_KEY, { phone, email, telegram, whatsapp: whatsapp || "79000000000" });
      if (window.showToast) window.showToast("Контакты сохранены. Обновите страницы сайта.", "success");
    });

    renderPromosList();
  }

  function initAdminContent() {
    initConstructor();

    const bookingsTableBody = document.querySelector(
      "#bookingsTable tbody"
    );
    const bookingsEmptyNote = document.getElementById("bookingsEmptyNote");

    if (bookingsTableBody) {
      bookingsTableBody.addEventListener("change", (e) => {
        const target = e.target;
        if (!target.matches) return;

        if (target.matches(".admin-status-select")) {
          if (target.disabled) return;
          const id = target.getAttribute("data-id");
          const newStatus = target.value;
          updateBookingStatus(id, newStatus);
          return;
        }

        if (target.matches(".admin-comment-input")) {
          if (target.disabled) return;
          const id = target.getAttribute("data-id");
          const newComment = target.value.trim();
          updateBookingAdminComment(id, newComment);
        }
      });
    }

    const reviewsTableBody = document.querySelector("#reviewsTable tbody");
    const reviewsEmptyNote = document.getElementById("reviewsEmptyNote");

    const exportBookingsBtn = document.getElementById("exportBookingsBtn");
    const exportBookingsCsvBtn = document.getElementById("exportBookingsCsvBtn");
    const clearBookingsBtn = document.getElementById("clearBookingsBtn");
    const exportReviewsBtn = document.getElementById("exportReviewsBtn");
    const clearReviewsBtn = document.getElementById("clearReviewsBtn");

    (async () => {
      await loadBookings();
      applyBookingsFilters();
      updateBookingsStatsAndChart();
      const searchInput = document.getElementById("bookingsSearch");
      const dateFrom = document.getElementById("bookingsDateFrom");
      const dateTo = document.getElementById("bookingsDateTo");
      const statusFilter = document.getElementById("bookingsStatusFilter");
      [searchInput, dateFrom, dateTo, statusFilter].forEach((el) => {
        if (el) {
          el.addEventListener("input", () => {
            applyBookingsFilters();
            updateBookingsStatsAndChart();
          });
          el.addEventListener("change", () => {
            applyBookingsFilters();
            updateBookingsStatsAndChart();
          });
        }
      });
    })();

    let adminReviews = loadJson(REVIEWS_KEY, []);

    function getStatusLabel(status) {
      const s = (status || "approved").toString().toLowerCase();
      if (s === "pending") return "На модерации";
      if (s === "approved") return "Одобрен";
      if (s === "rejected") return "Отклонён";
      return "Одобрен";
    }

    function updateReviewStatus(id, newStatus) {
      const list = loadJson(REVIEWS_KEY, []);
      const idx = list.findIndex((r) => String(r.id) === String(id));
      if (idx === -1) return;
      list[idx] = { ...list[idx], status: newStatus };
      saveJson(REVIEWS_KEY, list);
      adminReviews = list;
      renderReviewsTable();
      window.showToast(
        newStatus === "approved" ? "Отзыв одобрен и отображается на сайте." : "Отзыв отклонён.",
        "success"
      );
    }

    function renderReviewsTable() {
      if (!reviewsTableBody) return;
      reviewsTableBody.innerHTML = "";
      const reviews = loadJson(REVIEWS_KEY, []);

      if (!reviews.length) {
        if (reviewsEmptyNote) reviewsEmptyNote.style.display = "block";
        return;
      }
      if (reviewsEmptyNote) reviewsEmptyNote.style.display = "none";

      [...reviews]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )
        .forEach((r) => {
          const tr = document.createElement("tr");
          const status = (r.status || "approved").toString().toLowerCase();
          const photos =
            r.photos && r.photos.length
              ? `<button class="btn btn-ghost btn-xs admin-review-photos-btn" data-id="${r.id}">Открыть (${r.photos.length})</button>`
              : "—";
          const actions =
            status === "pending"
              ? `<button class="btn btn-primary btn-xs admin-review-approve" data-id="${r.id}">Одобрить</button>
                 <button class="btn btn-ghost btn-xs admin-review-reject" data-id="${r.id}">Отклонить</button>`
              : "—";
          const textPreview = (r.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const textShort = textPreview.slice(0, 80) + (textPreview.length > 80 ? "…" : "");
          tr.innerHTML = `
            <td>${(r.date || "").replace(/</g, "&lt;")}</td>
            <td>${(r.name || "").replace(/</g, "&lt;")}</td>
            <td>${r.rating || ""}</td>
            <td>${textShort}</td>
            <td>${photos}</td>
            <td>${getStatusLabel(status)}</td>
            <td style="white-space:nowrap;">${actions}</td>
          `;
          reviewsTableBody.appendChild(tr);
        });

      reviewsTableBody.querySelectorAll(".admin-review-approve").forEach((btn) => {
        btn.addEventListener("click", () => {
          updateReviewStatus(btn.getAttribute("data-id"), "approved");
        });
      });
      reviewsTableBody.querySelectorAll(".admin-review-reject").forEach((btn) => {
        btn.addEventListener("click", () => {
          updateReviewStatus(btn.getAttribute("data-id"), "rejected");
        });
      });
    }

    renderReviewsTable();

    reviewsTableBody.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(".admin-review-photos-btn")) return;

      const id = target.getAttribute("data-id");
      const reviews = loadJson(REVIEWS_KEY, []);
      const review = reviews.find((r) => String(r.id) === String(id));
      if (!review || !review.photos || !review.photos.length) {
        window.showToast("Для этого отзыва нет фото.", "error");
        return;
      }

      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Фото отзыва</title></head><body style='padding:16px;background:#f1f5f9;'>"
      );
      review.photos.forEach((src) => {
        if (src && typeof src === "string") {
          w.document.write(
            `<img src="${src.replace(/"/g, "&quot;")}" style="max-width:100%;display:block;margin-bottom:12px;border-radius:8px;">`
          );
        }
      });
      w.document.write("</body></html>");
      w.document.close();
    });

    if (exportBookingsBtn) {
      exportBookingsBtn.addEventListener("click", () => {
        const data = JSON.stringify(adminBookingsRaw, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bookings.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    function toCsvValue(value) {
      if (value == null) return "";
      const s = String(value);
      if (/[\";\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    if (exportBookingsCsvBtn) {
      exportBookingsCsvBtn.addEventListener("click", () => {
        const filtered = getFilteredBookings();
        const headers = [
          "ID заявки",
          "Дата создания",
          "Имя",
          "Телефон",
          "Услуга",
          "Площадь, сотки",
          "Сlot (запрошенное время выезда)",
          "Адрес",
          "Комментарий клиента",
          "Статус",
          "Комментарий администратора",
          "Источник",
        ];

        const rows = filtered.map((b) => {
          const status = formatStatusForStats(b.status);
          const source = detectBookingSource(b);
          return [
            toCsvValue(b.id ?? ""),
            toCsvValue(formatDateTime(b.created_at)),
            toCsvValue(b.fullName || ""),
            toCsvValue(b.phone || ""),
            toCsvValue(b.serviceType || ""),
            toCsvValue(
              b.area != null && !isNaN(Number(b.area))
                ? Math.round(Number(b.area) * 10) / 10
                : ""
            ),
            toCsvValue(b.slot || ""),
            toCsvValue(b.address || ""),
            toCsvValue(b.comment || ""),
            toCsvValue(status || ""),
            toCsvValue(b.adminComment || ""),
            toCsvValue(source || ""),
          ];
        });

        const lines = [headers.join(";"), ...rows.map((r) => r.join(";"))];
        const csvContent = "\uFEFF" + lines.join("\n");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bookings.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (clearBookingsBtn) {
      clearBookingsBtn.addEventListener("click", () => {
        if (
          !window.confirm(
            "Очистить все заявки из localStorage? Это действие нельзя отменить."
          )
        ) {
          return;
        }
        saveJson(BOOKINGS_KEY, []);
        window.location.reload();
      });
    }

    if (exportReviewsBtn) {
      exportReviewsBtn.addEventListener("click", () => {
        const data = JSON.stringify(loadJson(REVIEWS_KEY, []), null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "reviews.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (clearReviewsBtn) {
      clearReviewsBtn.addEventListener("click", () => {
        if (
          !window.confirm(
            "Очистить пользовательские отзывы? Базовые тестовые отзывы останутся."
          )
        ) {
          return;
        }
        const base = (window.initialReviews || []).slice();
        saveJson(REVIEWS_KEY, base);
        window.location.reload();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginSection = document.getElementById("adminLogin");
    const loginForm = document.getElementById("adminLoginForm");
    const protectedWrapper = document.getElementById("adminProtected");

    if (!loginSection || !loginForm || !protectedWrapper) {
      return;
    }

    const showAdmin = () => {
      loginSection.style.display = "none";
      protectedWrapper.style.display = "";
      initAdminContent();
    };

    if (isAdminAuthenticated()) {
      showAdmin();
      return;
    }

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const loginInput = document.getElementById("adminLoginInput");
      const passwordInput = document.getElementById("adminPasswordInput");

      const login = loginInput.value.trim();
      const password = passwordInput.value;

      if (!login || !password) {
        window.showToast("Введите логин и пароль.", "error");
        return;
      }

      if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        setAdminAuthenticated();
        window.showToast("Успешный вход в админ‑панель.", "success");
        showAdmin();
      } else {
        window.showToast("Неверный логин или пароль.", "error");
        passwordInput.value = "";
        passwordInput.focus();
      }
    });
  });
})();

