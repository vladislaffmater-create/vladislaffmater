(() => {
  const STORAGE_KEY = "pokos_reviews";

  const initialReviews = [
    {
      id: "r1",
      name: "Анна, Обнинск",
      date: "12.05.2024",
      rating: 5,
      text: "Очень аккуратно покосили участок 8 соток, учли все пожелания по грядкам и деревьям. Приехали в тот же день, всё оперативно.",
      photos: [],
      createdAt: "2024-05-12T10:00:00.000Z",
      status: "approved",
    },
    {
      id: "r2",
      name: "Игорь, Балабаново",
      date: "30.06.2024",
      rating: 5,
      text: "Сложный, сильно заросший участок, трава по пояс. За один выезд навели порядок, плюс вывезли всю траву. Рекомендую.",
      photos: [],
      createdAt: "2024-06-30T08:30:00.000Z",
      status: "approved",
    },
    {
      id: "r3",
      name: "Татьяна, Ворсино",
      date: "15.08.2024",
      rating: 4,
      text: "Постоянно заказываем покос 2–3 раза за сезон. Приезжают вовремя, после работ чисто. Иногда немного задерживаются, но всегда предупреждают.",
      photos: [],
      createdAt: "2024-08-15T12:00:00.000Z",
      status: "approved",
    },
  ];

  function loadReviews(onlyApproved = true) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let data;
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialReviews));
        data = [...initialReviews];
      } else {
        data = JSON.parse(raw);
        data = Array.isArray(data) ? data : [...initialReviews];
      }
      if (onlyApproved) {
        data = data.filter((r) => (r.status || "approved") === "approved");
      }
      return data;
    } catch {
      return onlyApproved ? initialReviews.filter((r) => (r.status || "approved") === "approved") : [...initialReviews];
    }
  }

  function loadAllReviews() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...initialReviews];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [...initialReviews];
    } catch {
      return [...initialReviews];
    }
  }

  function saveReviews(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function formatDate(d) {
    return new Intl.DateTimeFormat("ru-RU").format(d);
  }

  function renderReviews(list, container) {
    container.innerHTML = "";
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    sorted.forEach((rev) => {
      const card = document.createElement("article");
      card.className = "review-card";

      const photos = Array.isArray(rev.photos) ? rev.photos : [];
      const photosHtml = photos
        .filter((src) => src && typeof src === "string")
        .map(
          (src) =>
            `<a href="${src.replace(/"/g, "&quot;")}" data-lightbox="review-${String(rev.id).replace(/"/g, "")}" data-title="${String(rev.name || "").replace(/"/g, "&quot;")}">
              <img src="${src.replace(/"/g, "&quot;")}" class="review-photo-thumb" alt="Фото отзыва" loading="lazy">
            </a>`
        )
        .join("");

      card.innerHTML = `
        <div class="review-header">
          <div>
            <div class="review-name">${rev.name}</div>
            <div class="review-date">${rev.date}</div>
          </div>
          <div class="review-rating">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</div>
        </div>
        <div class="review-text">${rev.text}</div>
        ${
          photosHtml
            ? `<div class="review-photos">${photosHtml}</div>`
            : ""
        }
      `;

      container.appendChild(card);
    });
  }

  window.initialReviews = initialReviews;

  window.getLatestReviews = function getLatestReviews(count) {
    const list = loadReviews();
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted.slice(0, count);
  };

  document.addEventListener("DOMContentLoaded", () => {
    const listContainer = document.getElementById("reviewsList");
    const form = document.getElementById("reviewForm");

    if (listContainer) {
      const list = loadReviews();
      renderReviews(list, listContainer);
    }

    const ratingStars = Array.from(
      document.querySelectorAll(".rating-star")
    );
    const ratingValueInput = document.getElementById("ratingValue");

    function setRating(value) {
      ratingStars.forEach((btn) => {
        const v = Number(btn.getAttribute("data-value"));
        if (v <= value) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      ratingValueInput.value = String(value);
    }

    ratingStars.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = Number(btn.getAttribute("data-value"));
        setRating(value);
      });
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("reviewName");
        const textInput = document.getElementById("reviewText");
        const photosInput = document.getElementById("reviewPhotos");
        const rating = Number(ratingValueInput.value || 0);

        if (!nameInput.value.trim() || !textInput.value.trim() || !rating) {
          window.showToast("Заполните имя, оценку и текст отзыва.", "error");
          return;
        }

        const now = new Date();
        const base = {
          id: `r-${now.getTime()}`,
          name: nameInput.value.trim(),
          date: formatDate(now),
          rating,
          text: textInput.value.trim(),
          photos: [],
          createdAt: now.toISOString(),
          status: "pending",
        };

        const handleSave = (review) => {
          const list = loadAllReviews();
          list.push(review);
          saveReviews(list);

          if (listContainer) {
            renderReviews(loadReviews(), listContainer);
          }

          if (window.sendReviewToTelegram) {
            window.sendReviewToTelegram(review);
          }

          window.showToast(
            "Отзыв отправлен и появится после небольшой проверки.",
            "success"
          );
          form.reset();
          setRating(0);
        };

        const files = photosInput.files;
        if (!files || files.length === 0) {
          handleSave(base);
          return;
        }

        const maxFiles = Math.min(files.length, 3);
        const readers = [];

        for (let i = 0; i < maxFiles; i++) {
          const file = files[i];
          const reader = new FileReader();
          readers.push(
            new Promise((resolve) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            })
          );
        }

        Promise.all(readers).then((results) => {
          base.photos = results.filter(Boolean);
          setTimeout(() => handleSave(base), 600);
        });
      });
    }
  });
})();

