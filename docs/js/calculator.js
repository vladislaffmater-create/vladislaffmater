(() => {
  const BASE_PRICE = 450;

  function formatPrice(value) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  }

  window.getCalculatedPrice = function getCalculatedPrice() {
    const result = document.getElementById("calcPriceValue");
    if (!result) return null;
    const raw = result.getAttribute("data-price");
    return raw ? Number(raw) : null;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("priceCalculator");
    const resultLabel = document.getElementById("calcPriceValue");
    const bookingBtn = document.getElementById("calcToBooking");

    if (!form || !resultLabel || !bookingBtn) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const areaInput = document.getElementById("calcArea");
      const conditionInput = form.querySelector('input[name="condition"]:checked');

      const area = areaInput && areaInput.value ? Number(areaInput.value) : 0;
      const coeff = conditionInput ? Number(conditionInput.value) : 1;

      if (!area || area <= 0) {
        window.showToast("Введите корректную площадь участка.", "error");
        return;
      }

      let extrasPerSotka = 0;
      const extraCollect = form.querySelector('input[name="extraCollect"]');
      const extraRemove = form.querySelector('input[name="extraRemove"]');

      if (extraCollect && extraCollect.checked) {
        extrasPerSotka += Number(extraCollect.value);
      }
      if (extraRemove && extraRemove.checked) {
        extrasPerSotka += Number(extraRemove.value);
      }

      const pricePerSotka = BASE_PRICE * coeff + extrasPerSotka;
      const total = Math.round(pricePerSotka * area);

      resultLabel.textContent = formatPrice(total);
      resultLabel.setAttribute("data-price", String(total));
      bookingBtn.removeAttribute("disabled");
    });

    bookingBtn.addEventListener("click", () => {
      const areaInput = document.getElementById("calcArea");
      const conditionInput = form.querySelector('input[name="condition"]:checked');
      const price = window.getCalculatedPrice();

      const payload = {
        area: areaInput && areaInput.value ? areaInput.value : "",
        condition: conditionInput ? conditionInput.value : "",
        price: price || null,
      };

      sessionStorage.setItem("pokos_bookingFromCalc", JSON.stringify(payload));
      window.location.href = "booking.html";
    });
  });
})();

