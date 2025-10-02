
//   <!-- 화면 전환 로직 (애니메이션 그대로 유지) -->
const VIEW = {
  home: "home_navigation.html",
  weather: "weather.html",
  mypage: "portfolio.html",
};


const btnMyPage   = document.getElementById('btn-mypage');
const btnWeather  = document.getElementById('btn-weather');
const btnHome     = document.getElementById('btn-home');
const mainUI      = document.getElementById('main-ui');
const portfolio   = document.getElementById('portfolio');
const weatherPage = document.getElementById('weather-page');

let isTransitioning = false;

function showPage(targetEl){
    if(isTransitioning || targetEl.style.display==='block') return;
    isTransitioning = true;

    mainUI.classList.add('slide-out-right');
    mainUI.addEventListener('animationend', function handler(){
    mainUI.removeEventListener('animationend', handler);
    mainUI.style.display = 'none';
    mainUI.classList.remove('slide-out-right');

    targetEl.style.display = 'block';
    targetEl.offsetHeight;
    targetEl.classList.add('slide-in-left');
    targetEl.addEventListener('animationend', function handler2(){
        targetEl.removeEventListener('animationend', handler2);
        targetEl.classList.remove('slide-in-left');
        isTransitioning = false;
    }, { once: true });
    }, { once: true });
}

function backToMain(fromEl){
    if(isTransitioning || mainUI.style.display !== 'none' || fromEl.style.display!=='block') return;
    isTransitioning = true;

    fromEl.classList.add('slide-out-right');
    fromEl.addEventListener('animationend', function handler(){
    fromEl.removeEventListener('animationend', handler);
    fromEl.style.display = 'none';
    fromEl.classList.remove('slide-out-right');

    mainUI.style.display = 'flex';
    mainUI.offsetHeight;
    mainUI.classList.add('slide-in-left');
    mainUI.addEventListener('animationend', function handler2(){
        mainUI.removeEventListener('animationend', handler2);
        mainUI.classList.remove('slide-in-left');
        isTransitioning = false;
    }, { once: true });
    }, { once: true });
}

btnMyPage.addEventListener('click', () => showPage(portfolio));
btnWeather.addEventListener('click', () => {
    showPage(weatherPage);
    // 날씨 페이지 진입 시 갱신
    initForecastMode();
    getLocationAndRun();
});
btnHome.addEventListener('click', () => {
    if(portfolio.style.display==='block') backToMain(portfolio);
    else if(weatherPage.style.display==='block') backToMain(weatherPage);
});

//   <!-- 프로그레스 바 IntersectionObserver -->
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
    if (entry.isIntersecting) {
        const bar = entry.target;
        const skill = bar.getAttribute('data-skill');
        bar.style.width = skill;
        observer.unobserve(bar);
    }
    });
}, { threshold: 0.5 });
document.querySelectorAll('.progress-bar').forEach(bar => observer.observe(bar));

//   <!-- Weather (현황 요약 텍스트) -->
const WEATHER_API_KEY = 'fcb38d401a2c340a7654798eb36263b3';
const WEATHER_REFRESH_MS = 10 * 60 * 1000;

async function fetchWeatherByCoords(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`;
    const { data } = await axios.get(url);
    return data;
}
async function fetchWeatherByCity(city = 'seoul') {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`;
    const { data } = await axios.get(url);
    return data;
}
function updateWeatherText(data) {
    const el = document.getElementById('weatherText');
    if (!el || !data) return;
    const temp = Math.round(data.main?.temp);
    const desc = data.weather?.[0]?.description || '';
    const hum  = data.main?.humidity ?? '-';
    const wind = data.wind?.speed ?? '-';
    el.textContent = `${desc} ${temp}°C · ${hum}% · ${wind} m/s`;
}
async function refreshWeatherOnce() {
    try {
    if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
        });
        const { latitude, longitude } = pos.coords;
        updateWeatherText(await fetchWeatherByCoords(latitude, longitude));
        return;
    }
    throw new Error('geolocation unsupported');
    } catch {
    try { updateWeatherText(await fetchWeatherByCity('seoul')); } catch { /* ignore */ }
    }
}
function startWeatherAutoRefresh() {
    refreshWeatherOnce();
    setInterval(refreshWeatherOnce, WEATHER_REFRESH_MS);
}
window.addEventListener('load', startWeatherAutoRefresh);

{/* <!-- Kakao 지도 + 검색 + 길찾기 (오버레이) --> */}
// 전역
let mainMap, placesSvc, infoWin, currentPos, baseMarker, routeLine, tempMarkers = [];

function initMainMap(){
    const container = document.getElementById('mainMap');
    const fallback  = new kakao.maps.LatLng(37.50136,127.0396);

    mainMap = new kakao.maps.Map(container, { center:fallback, level:4 });
    infoWin  = new kakao.maps.InfoWindow({ zIndex:1 });
    placesSvc= new kakao.maps.services.Places();

    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        currentPos = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        baseMarker = new kakao.maps.Marker({ map: mainMap, position: currentPos });
        mainMap.setCenter(currentPos);
    }, () => {
        baseMarker = new kakao.maps.Marker({ map: mainMap, position: fallback });
    });
    }
}

function clearRoute(){ if(routeLine) routeLine.setMap(null); }
function clearTempMarkers(){ tempMarkers.forEach(m=>m.setMap(null)); tempMarkers=[]; }

function searchPlaces(){
    const kw = document.getElementById('search-input').value.trim();
    if(!kw) return;

    placesSvc.keywordSearch(kw, (data, status) => {
    clearTempMarkers();
    const listEl = document.getElementById('search-results'); listEl.innerHTML='';

    if(status !== kakao.maps.services.Status.OK){
        listEl.innerHTML = '<div class="text-muted">검색 결과 없음</div>';
        return;
    }

    data.slice(0,5).forEach(p=>{
        const pos = new kakao.maps.LatLng(p.y,p.x);
        const mk  = new kakao.maps.Marker({ map:mainMap, position:pos });
        tempMarkers.push(mk);

        const item = document.createElement('div');
        item.className='item';
        item.innerHTML = `<strong>${p.place_name}</strong><br>${p.road_address_name || p.address_name || ''}`;
        item.addEventListener('click', ()=> selectDestination(p,pos,mk));
        listEl.appendChild(item);

        kakao.maps.event.addListener(mk,'click',()=> selectDestination(p,pos,mk));
    });
    });
}

function closeSearchOverlay(){
    document.getElementById('mapSearchOverlay').classList.remove('open');
}

function selectDestination(place,pos,mk){
    mainMap.setCenter(pos);
    /* 선택 목적지 인포윈도우를 검은 글씨로 */
    infoWin.setContent(`<div style="padding:5px;font-size:13px;color:#000;">${place.place_name}</div>`);
    infoWin.open(mainMap,mk);

    /* 선택된 목적지 외 모든 검색 마커 제거 */
    tempMarkers.forEach(m => { if(m !== mk) m.setMap(null); });
    tempMarkers = [mk];

    if(currentPos) drawRoute(currentPos,pos);
    closeSearchOverlay();
}

async function drawRoute(start,end){
    clearRoute();
    try{
    const url = "https://apis-navi.kakaomobility.com/v1/directions";
    const res = await axios.get(url,{
        headers:{ Authorization:"KakaoAK 30244d1f4d499bc08613f39b6e4a4030" },
        params :{ origin:`${start.getLng()},${start.getLat()}`, destination:`${end.getLng()},${end.getLat()}` }
    });

    const roads = res.data.routes[0].sections[0].roads;
    const path = [];
    roads.forEach(r=>{
        for(let i=0;i<r.vertexes.length;i+=2){
        path.push(new kakao.maps.LatLng(r.vertexes[i+1], r.vertexes[i]));
        }
    });

    routeLine = new kakao.maps.Polyline({
        map:mainMap, path, strokeWeight:5, strokeColor:"#FF0000", strokeOpacity:0.9, strokeStyle:"solid"
    });

    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(p=>bounds.extend(p));
    mainMap.setBounds(bounds);
    }catch(err){
    console.error("길찾기 API 오류",err);
    }
}

// 오버레이 토글 & 이벤트 바인딩
const btnSearch   = document.getElementById('btn-search');
const overlay     = document.getElementById('mapSearchOverlay');
const closeBtn    = document.getElementById('search-close');

btnSearch.addEventListener('click', () => {
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open')) {
    document.getElementById('search-input').focus();
    }
});
closeBtn.addEventListener('click', closeSearchOverlay);

document.getElementById('search-button').addEventListener('click', searchPlaces);
document.getElementById('search-input').addEventListener('keydown', e=>{ if(e.key==='Enter') searchPlaces(); });

window.addEventListener('load', initMainMap);

//   <!-- Weather Page: 3시간 간격 5장 + 모드 토글/키보드 스크롤 -->
const OWM_API_KEY = 'fcb38d401a2c340a7654798eb36263b3';
const CARD_COUNT  = 5;

const $track     = document.getElementById('forecastTrack');
const $placeName = document.getElementById('placeName');
const $updatedAt = document.getElementById('updatedAt');
const $weatherPg = document.getElementById('weather-page');
const $modeBtn   = document.getElementById('modeToggle');

function fmtTime(ts) {
    const d = new Date(ts * 1000);
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
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

function renderSkeleton(n = CARD_COUNT) {
    $track.innerHTML = "";
    for (let i = 0; i < n; i++) {
    const div = document.createElement("div");
    div.className = "skeleton";
    $track.appendChild(div);
    }
}

function renderCards(list) {
    $track.innerHTML = "";
    const five = list.slice(0, CARD_COUNT);
    for (const item of five) {
    const time  = fmtTime(item.dt);
    const temp  = Math.round(item.main?.temp ?? 0);
    const main  = item.weather?.[0]?.main || "";
    const rawDesc = item.weather?.[0]?.description || "";
    const desc  = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);
    const humidity = item.main?.humidity ?? "--";
    const wind  = (item.wind?.speed != null) ? Number(item.wind.speed).toFixed(1) : "--";

    const sec = document.createElement("section");
    sec.className = "forecast-card";
    sec.setAttribute("aria-label", `${time} 예보 카드`);
    sec.innerHTML = `
        <header class="card-head">
        <div class="card-time">${time}</div>
        <div class="card-place">${$placeName.textContent || "현재 위치"}</div>
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
    $track.appendChild(sec);
    }
    // 스크롤 초기화
    $track.scrollTo({ left: 0, top: 0, behavior: 'instant' });
}

async function fetchForecast(lat, lon) {
    renderSkeleton(CARD_COUNT);
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=kr`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || (data.cod && Number(data.cod) !== 200)) {
    console.error("Forecast API error:", data);
    $placeName.textContent = "위치 불러오기 실패";
    $track.innerHTML = "<div class='text-danger px-2'>예보를 불러오지 못했습니다.</div>";
    return;
    }
    $placeName.textContent = data.city?.name || "현재 위치";
    const now = new Date();
    $updatedAt.textContent = `업데이트: ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    renderCards(data.list || []);
}

function getLocationAndRun() {
    const fallbackSeoul = () => fetchForecast(37.5665, 126.9780);
    if (!navigator.geolocation) return fallbackSeoul();
    navigator.geolocation.getCurrentPosition(
    pos => fetchForecast(pos.coords.latitude, pos.coords.longitude),
    err => { console.warn("위치 접근 실패:", err); fallbackSeoul(); },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
}

// 보기 모드(가로/세로) 저장/적용
function applyMode(mode) {
    $weatherPg.classList.remove('mode-horizontal', 'mode-vertical');
    $weatherPg.classList.add(mode === 'vertical' ? 'mode-vertical' : 'mode-horizontal');
    const icon = $modeBtn.querySelector('i');
    if (icon) {
    icon.className = 'bi bi-layout-split';
    if (mode === 'vertical') icon.classList.add('rotate-90');
    }
    $track.scrollTo({ left: 0, top: 0, behavior: 'instant' });
}
function initForecastMode() {
    const saved = localStorage.getItem('forecastMode') || 'horizontal';
    applyMode(saved);
}
$modeBtn.addEventListener('click', () => {
    const current = $weatherPg.classList.contains('mode-vertical') ? 'vertical' : 'horizontal';
    const next = current === 'vertical' ? 'horizontal' : 'vertical';
    localStorage.setItem('forecastMode', next);
    applyMode(next);
});

// 키보드 좌우 스크롤
(function enableKeyboardScroll(){
    $track.addEventListener("keydown", (e) => {
    const step = Math.round($track.clientWidth * 0.9);
    if (e.key === "ArrowRight") { e.preventDefault(); $track.scrollBy({ left: step, behavior: "smooth" }); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); $track.scrollBy({ left: -step, behavior: "smooth" }); }
    });
})();

// 페이지가 열려 있을 때만 주기 갱신
setInterval(() => {
    if (weatherPage.style.display === 'block') getLocationAndRun();
}, 30 * 60 * 1000);