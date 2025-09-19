import { HomePage } from './navigation.js';
import { WeatherPage } from './weather.js';
import { PortfolioPage } from './portfolio.js';
import { LogPage } from './log.js';

// =========================
//  SPA 라우팅/화면전환 공통
// =========================
const VIEW = {
  home: "home_navigation.html",
  weather: "weather.html",
  mypage: "portfolio.html",
  logs: "log.html"
};

const btnMyPage = document.getElementById("btn-mypage");
const btnWeather = document.getElementById("btn-weather");
const btnHome = document.getElementById("btn-home");
const mainUI = document.getElementById("main-ui");
const btnLogs = document.getElementById("btn-logs");

let isTransitioning = false;
let currentCleanup = null; // 페이지 변경 시 리스너/타이머 해제용

function setActive(btnId) {
  ["btn-home", "btn-weather", "btn-mypage", "btn-logs"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("active", id === btnId);
  });
}

async function fetchPartial(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.text();
}

async function loadView(path, activeBtnId) {
  if (isTransitioning) return;
  isTransitioning = true;

  // 이전 페이지 정리
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch { }
    currentCleanup = null;
  }

  // slide-out
  mainUI.classList.add("slide-out-right");
  await new Promise(resolve => {
    mainUI.addEventListener("animationend", resolve, { once: true });
  });
  mainUI.classList.remove("slide-out-right");

  // 교체
  try {
    const html = await fetchPartial(path);
    mainUI.innerHTML = html;
  } catch (e) {
    console.error(e);
    mainUI.innerHTML = `<div class="p-3 text-danger">Failed to load: ${path}</div>`;
  }

  // slide-in
  mainUI.classList.add("slide-in-left");
  await new Promise(resolve => {
    mainUI.addEventListener("animationend", resolve, { once: true });
  });
  mainUI.classList.remove("slide-in-left");

  isTransitioning = false;
  setActive(activeBtnId);

  // 페이지별 init 실행
  currentCleanup = routeInit(mainUI);
}

// 첫 진입: 홈
document.addEventListener("DOMContentLoaded", () => {
  loadView(VIEW.home, "btn-home");
});

// 네비 버튼
btnWeather?.addEventListener("click", () => loadView(VIEW.weather, "btn-weather"));
btnMyPage?.addEventListener("click", () => loadView(VIEW.mypage, "btn-mypage"));
btnHome?.addEventListener("click", () => loadView(VIEW.home, "btn-home"));
btnLogs?.addEventListener("click", () => loadView(VIEW.logs, "btn-logs"));


// =========================
//  라우트 디스패처
//  - 현재 로드된 partial의 루트/요소 존재여부로 페이지 판별
//  - 각 init은 cleanup 함수를 반환(없으면 null 반환)
// =========================
function routeInit(root) {
  // weather.html 인가?
  if (root.querySelector("#weather-page")) {
    return WeatherPage.init(root);
  }
  // portfolio.html 인가?
  if (root.querySelector("#portfolio")) {
    return PortfolioPage.init(root);
  }
  if (root.querySelector("#log-page")) {
    return LogPage.init(root);
  }
  // 그 외는 home_navigation.html
  return HomePage.init(root);
}