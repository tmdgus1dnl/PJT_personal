
// =========================
//  Weather Page(예보 3시간 간격)
//  (weather.html 안의 #weather-page, #forecastTrack, #placeName, #updatedAt, #modeToggle)
// =========================
export const WeatherPage = (() => {
  const OWM_API_KEY = "fcb38d401a2c340a7654798eb36263b3";
  const CARD_COUNT = 5;
  let refreshInterval = null;

  function fmtTime(ts) {
    const d = new Date(ts * 1000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  function iconClassByMain(mainStr) {
    const w = (mainStr || "").toLowerCase();
    if (w.includes("clear")) return "bi bi-brightness-high-fill";
    if (w.includes("cloud")) return "bi bi-cloud-fill";
    if (w.includes("rain") || w.includes("drizzle") || w.includes("thunder")) return "bi bi-cloud-rain-fill";
    if (w.includes("snow")) return "bi bi-snow";
    if (w.includes("mist") || w.includes("fog") || w.includes("haze") || w.includes("smoke")) return "bi bi-cloud-fog-fill";
    if (w.includes("dust") || w.includes("sand")) return "bi bi-wind";
    if (w.includes("tornado") || w.includes("squall")) return "bi bi-tornado";
    return "bi bi-brightness-low-fill";
  }

  function renderSkeleton(track, n = CARD_COUNT) {
    track.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.className = "skeleton";
      track.appendChild(div);
    }
  }

  function renderCards(track, placeNameEl, list) {
    track.innerHTML = "";
    const five = list.slice(0, CARD_COUNT);
    for (const item of five) {
      const time = fmtTime(item.dt);
      const temp = Math.round(item.main?.temp ?? 0);
      const main = item.weather?.[0]?.main || "";
      const rawDesc = item.weather?.[0]?.description || "";
      const desc = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);
      const humidity = item.main?.humidity ?? "--";
      const wind = (item.wind?.speed != null) ? Number(item.wind.speed).toFixed(1) : "--";

      const sec = document.createElement("section");
      sec.className = "forecast-card";
      sec.setAttribute("aria-label", `${time} 예보 카드`);
      sec.innerHTML = `
        <header class="card-head">
          <div class="card-time">${time}</div>
          <div class="card-place">${placeNameEl.textContent || "현재 위치"}</div>
        </header>
        <div class="card-mid">
          <div class="card-icon"><i class="${iconClassByMain(main)}" aria-hidden="true"></i></div>
          <div class="card-temp">${temp}°C</div>
          <div class="card-desc">${desc}</div>
        </div>
        <footer class="card-extra">
          <div class="extra-item"><span class="label">습도</span><span class="value">💧 ${humidity}%</span></div>
          <div class="extra-item"><span class="label">풍속</span><span class="value">🌬 ${wind} m/s</span></div>
        </footer>
      `;
      track.appendChild(sec);
    }
    track.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }

  async function fetchForecast(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=kr`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || (data.cod && Number(data.cod) !== 200)) {
      throw new Error(JSON.stringify(data));
    }
    return data;
  }

  function applyMode(weatherPageEl, track, btn) {
    const mode = localStorage.getItem("forecastMode") || "horizontal";
    weatherPageEl.classList.remove("mode-horizontal", "mode-vertical");
    weatherPageEl.classList.add(mode === "vertical" ? "mode-vertical" : "mode-horizontal");
    const icon = btn.querySelector("i");
    if (icon) {
      icon.className = "bi bi-layout-split";
      if (mode === "vertical") icon.classList.add("rotate-90");
    }
    track.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }

  function init(root) {
    const weatherPageEl = root.querySelector("#weather-page");
    const track = root.querySelector("#forecastTrack");
    const placeName = root.querySelector("#placeName");
    const updatedAt = root.querySelector("#updatedAt");
    const modeBtn = root.querySelector("#modeToggle");

    if (!weatherPageEl || !track || !placeName || !updatedAt || !modeBtn) {
      return null;
    }

    function getLocationAndRun() {
      renderSkeleton(track);
      const fallback = () => fetchForecast(37.5665, 126.9780).then(updateByData).catch(showError);

      if (!navigator.geolocation) return fallback();
      navigator.geolocation.getCurrentPosition(
        pos => fetchForecast(pos.coords.latitude, pos.coords.longitude).then(updateByData).catch(showError),
        () => fallback(),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    }

    function updateByData(data) {
      placeName.textContent = data.city?.name || "현재 위치";
      const now = new Date();
      updatedAt.textContent = `업데이트: ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      renderCards(track, placeName, data.list || []);
    }

    function showError(err) {
      console.error("Forecast API error:", err);
      placeName.textContent = "위치 불러오기 실패";
      track.innerHTML = "<div class='text-danger px-2'>예보를 불러오지 못했습니다.</div>";
    }

    // 모드 토글
    function toggleMode() {
      const current = weatherPageEl.classList.contains("mode-vertical") ? "vertical" : "horizontal";
      const next = current === "vertical" ? "horizontal" : "vertical";
      localStorage.setItem("forecastMode", next);
      applyMode(weatherPageEl, track, modeBtn);
    }
    modeBtn.addEventListener("click", toggleMode);

    // 초기 모드 + 데이터 로드
    applyMode(weatherPageEl, track, modeBtn);
    getLocationAndRun();

    // 30분 주기 갱신(이 페이지가 열려 있을 때만)
    refreshInterval = setInterval(() => {
      // 루트가 교체되면 elements가 사라지므로 체크
      if (!document.body.contains(weatherPageEl)) return;
      getLocationAndRun();
    }, 30 * 60 * 1000);

    // cleanup
    return () => {
      modeBtn.removeEventListener("click", toggleMode);
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }

  return { init };
})();
