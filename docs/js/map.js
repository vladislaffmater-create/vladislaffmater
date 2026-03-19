(() => {
  function initServiceMap() {
    const el = document.getElementById("serviceMap");
    if (!el) return;

    const center = [55.0944, 36.6105];
    const map = new ymaps.Map(el, {
      center,
      zoom: 8,
      controls: ["zoomControl"],
    });

    // Основная (зелёная) зона: центр и радиус подобраны так,
    // чтобы верхняя часть круга доходила примерно до Наро-Фоминска,
    // а нижняя — до района Головтеево.
    const baseCenter = [55.04, 36.62];

    const baseCircle = new ymaps.Circle(
      [baseCenter, 38000],
      {},
      {
        fillColor: "rgba(34, 197, 94, 0.18)",
        strokeColor: "#16a34a",
        strokeWidth: 3,
      }
    );

    // Расширенная зона (по согласованию):
    // делаем "кольцо": оранжевая область вокруг зелёного круга,
    // без заливки внутри зелёной зоны.
    const extendedCenter = [54.945, 36.5]; // середина между Калугой и Наро-Фоминском
    const extendedRadius = 51000; // внешний радиус ~48 км

    function createCircleCoords(centerCoords, radiusMeters, points) {
      const coords = [];
      const lat = centerCoords[0];
      const lon = centerCoords[1];
      const degToRad = Math.PI / 180;
      const latRadius = radiusMeters / 111320;
      const lonRadius =
        radiusMeters / (111320 * Math.cos(lat * degToRad) || 1);

      for (let i = 0; i < points; i++) {
        const angle = (2 * Math.PI * i) / points;
        const dLat = latRadius * Math.sin(angle);
        const dLon = lonRadius * Math.cos(angle);
        coords.push([lat + dLat, lon + dLon]);
      }

      return coords;
    }

    const outerCoords = createCircleCoords(extendedCenter, extendedRadius, 80);
    // Внутренняя граница делаем чуть больше зелёного круга,
    // чтобы внутри зелёной зоны не было видно оранжевой заливки.
    const innerCoords = createCircleCoords(baseCenter, 39000, 80).reverse();

    // Заполненное оранжевое "кольцо" без обводки —
    // чтобы внутренняя граница не рисовала пунктир по зелёному кругу.
    const extendedRing = new ymaps.Polygon(
      [outerCoords, innerCoords],
      {},
      {
        fillColor: "rgba(250, 204, 21, 0.12)", // светло-оранжевый
        strokeWidth: 0,
      }
    );

    // Отдельно рисуем только внешнюю оранжевую границу пунктиром.
    const extendedBorder = new ymaps.Circle(
      [extendedCenter, extendedRadius],
      {},
      {
        fillOpacity: 0,
        strokeColor: "rgba(245, 158, 11, 0.95)",
        strokeWidth: 2,
        strokeStyle: "shortdash",
      }
    );

    const label = new ymaps.Placemark(
      [54.8, 37.1], // сдвигаем подпись ниже и правее, чтобы не перекрывала зелёный круг
      {
        balloonContent: "Светло-оранжевая зона — выезд по согласованию",
        hintContent: "Расширенная зона по согласованию",
        iconCaption: "Зона по согласованию",
      },
      {
        preset: "islands#orangeCircleDotIcon",
      }
    );

    map.geoObjects.add(extendedRing).add(extendedBorder).add(baseCircle).add(label);
  }

  function initOfficeMap() {
    const el = document.getElementById("officeMap");
    if (!el) return;

    const center = [55.0944, 36.6105];
    const map = new ymaps.Map(el, {
      center,
      zoom: 12,
      controls: ["zoomControl"],
    });

    const placemark = new ymaps.Placemark(
      center,
      {
        balloonContent:
          "Покос-Обнинск — выездной сервис по покосу травы в Обнинске и области.",
      },
      {
        preset: "islands#greenDotIcon",
      }
    );

    map.geoObjects.add(placemark);
  }

  function onYandexReady() {
    initServiceMap();
    initOfficeMap();
  }

  if (window.ymaps && window.ymaps.ready) {
    window.ymaps.ready(onYandexReady);
  } else {
    window.addEventListener("load", () => {
      if (window.ymaps && window.ymaps.ready) {
        window.ymaps.ready(onYandexReady);
      }
    });
  }
})();

