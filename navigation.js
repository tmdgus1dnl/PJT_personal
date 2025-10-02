// =========================
//  Home: 날씨 요약 + 카카오 지도/검색/길찾기
//  (home_navigation.html 안의 요소를 기준으로 동작)
// =========================
export const HomePage = (() => {
  const WEATHER_API_KEY = "fcb38d401a2c340a7654798eb36263b3";
  const WEATHER_REFRESH_MS = 10 * 60 * 1000;
  let refreshTimer = null;
  async function fetchWeatherByCoords(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`;
    const { data } = await axios.get(url);
    return data;
  }
  async function fetchWeatherByCity(city = "seoul") {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`;
    const { data } = await axios.get(url);
    return data;
  }
  function updateWeatherText(root, data) {
    const el = root.querySelector("#weatherText");
    if (!el || !data) return;
    const temp = Math.round(data.main?.temp);
    const desc = data.weather?.[0]?.description || "";
    const hum = data.main?.humidity ?? "-";
    const wind = data.wind?.speed ?? "-";
    el.textContent = `${desc} ${temp}°C · ${hum}% · ${wind} m/s`;
  }
  async function refreshWeatherOnce(root) {
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 }));
        const { latitude, longitude } = pos.coords;
        updateWeatherText(root, await fetchWeatherByCoords(latitude, longitude));
        return;
      }
      throw new Error("geolocation unsupported");
    } catch {
      try { updateWeatherText(root, await fetchWeatherByCity("seoul")); } catch {}
    }
  }
  // Kakao 지도/검색/길찾기
  function initMapBlock(root) {
    const container = root.querySelector("#mainMap");
    if (!container || !window.kakao?.maps) return;
    const fallback = new kakao.maps.LatLng(37.50136, 127.0396);
    const map = new kakao.maps.Map(container, { center: fallback, level: 4 });
    const infoWin = new kakao.maps.InfoWindow({ zIndex: 1 });
    const placesSvc = new kakao.maps.services.Places();
    let currentPos, baseMarker, routeLine, tempMarkers = [];
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        currentPos = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        baseMarker = new kakao.maps.Marker({ map, position: currentPos });
        map.setCenter(currentPos);
      }, () => {
        baseMarker = new kakao.maps.Marker({ map, position: fallback });
      });
    }
    function clearRoute() { if (routeLine) routeLine.setMap(null); }
    function clearTempMarkers() { tempMarkers.forEach(m => m.setMap(null)); tempMarkers = []; }
    async function drawRoute(start, end) {
      clearRoute();
      try {
        const url = "https://apis-navi.kakaomobility.com/v1/directions";
        const res = await axios.get(url, {
          headers: { Authorization: "KakaoAK 30244d1f4d499bc08613f39b6e4a4030" },
          params: { origin: `${start.getLng()},${start.getLat()}`, destination: `${end.getLng()},${end.getLat()}` }
        });
        const roads = res.data.routes[0].sections[0].roads;
        const path = [];
        roads.forEach(r => {
          for (let i = 0; i < r.vertexes.length; i += 2) {
            path.push(new kakao.maps.LatLng(r.vertexes[i + 1], r.vertexes[i]));
          }
        });
        routeLine = new kakao.maps.Polyline({
          map, path, strokeWeight: 5, strokeColor: "#FF0000", strokeOpacity: 0.9, strokeStyle: "solid"
        });
        const bounds = new kakao.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.setBounds(bounds);
      } catch (err) {
        console.error("길찾기 API 오류", err);
      }
    }
    function selectDestination(place, pos, mk) {
      map.setCenter(pos);
      infoWin.setContent(`<div style="padding:5px;font-size:13px;color:#000;">${place.place_name}</div>`);
      infoWin.open(map, mk);
      tempMarkers.forEach(m => { if (m !== mk) m.setMap(null); });
      tempMarkers = [mk];
      if (currentPos) drawRoute(currentPos, pos);
      root.querySelector("#mapSearchOverlay")?.classList.remove("open");
    }
    // 검색 오버레이 바인딩
    const btnSearch = root.querySelector("#btn-search");
    const overlay = root.querySelector("#mapSearchOverlay");
    const closeBtn = root.querySelector("#search-close");
    const inputEl = root.querySelector("#search-input");
    const resultsEl = root.querySelector("#search-results");
    const searchBtn = root.querySelector("#search-button");
    function searchPlaces() {
      const kw = (inputEl?.value || "").trim();
      if (!kw) return;
      placesSvc.keywordSearch(kw, (data, status) => {
        clearTempMarkers();
        if (resultsEl) resultsEl.innerHTML = "";
        if (status !== kakao.maps.services.Status.OK) {
          if (resultsEl) resultsEl.innerHTML = '<div class="text-muted">검색 결과 없음</div>';
          return;
        }
        data.slice(0, 5).forEach(p => {
          const pos = new kakao.maps.LatLng(p.y, p.x);
          const mk = new kakao.maps.Marker({ map, position: pos });
          tempMarkers.push(mk);
          if (resultsEl) {
            const item = document.createElement("div");
            item.className = "item";
            item.innerHTML = `<strong>${p.place_name}</strong><br>${p.road_address_name || p.address_name || ""}`;
            item.addEventListener("click", () => selectDestination(p, pos, mk));
            resultsEl.appendChild(item);
          }
          kakao.maps.event.addListener(mk, "click", () => selectDestination(p, pos, mk));
        });
      });
    }
    btnSearch?.addEventListener("click", () => {
      overlay?.classList.toggle("open");
      if (overlay?.classList.contains("open")) inputEl?.focus();
    });
    closeBtn?.addEventListener("click", () => overlay?.classList.remove("open"));
    searchBtn?.addEventListener("click", searchPlaces);
    inputEl?.addEventListener("keydown", e => { if (e.key === "Enter") searchPlaces(); });
    // cleanup function returned
    return () => { clearRoute(); clearTempMarkers(); };
  }
  function init(root) {
    // 날씨 요약 시작
    refreshWeatherOnce(root);
    refreshTimer = setInterval(() => refreshWeatherOnce(root), WEATHER_REFRESH_MS);
    // 카카오 지도 블록
    const mapCleanup = initMapBlock(root);
    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
      if (typeof mapCleanup === "function") mapCleanup();
    };
  }
  return { init };
})();