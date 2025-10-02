import { HomePage } from './navigation.js';
import { WeatherPage } from './weather.js';
import { PortfolioPage } from './portfolio.js';
import { LogPage } from './log.js';
import { ChatbotPage } from './chatbot.js';
import { ProfilePage } from './profile.js';
import { LoginPage } from './login.js';
import { SignupPage } from './signup.js';
import { SettingsPage } from './settings.js';
import { AdminPage } from './admin.js';
import { getCurrentUser } from './auth.js';
import { refreshGreeting } from './user.js';

// =========================
//  SPA 라우팅/화면전환 공통
// =========================
const VIEW = {
  home: 'home_navigation.html',
  weather: 'weather.html',
  mypage: 'portfolio.html',
  logs: 'log.html',
  chatbot: 'chatbot.html',
  profile: 'profile.html',
  login: 'login.html',
  signup: 'signup.html',
  settings: 'settings.html',
  admin: 'admin.html',
};

const btnWeather = document.getElementById('btn-weather');
const btnMyPage = document.getElementById('btn-mypage');
const btnLogs = document.getElementById('btn-settings-logs');
const btnChatbot = document.getElementById('btn-chatbot');
const btnProfile = document.getElementById('btn-profile');
const btnSettings = document.getElementById('btn-settings');
const btnAdmin = document.getElementById('btn-settings-admin');
const btnHome = document.getElementById('btn-home');
const mainUI = document.getElementById('main-ui');

let isTransitioning = false;
let currentCleanup = null; // 페이지 변경 시 리스너/타이머 해제용

function setActive(btnId) {
  ['btn-home', 'btn-weather', 'btn-mypage', 'btn-settings-logs', 'btn-chatbot', 'btn-profile', 'btn-settings', 'btn-settings-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === btnId);
  });
}

async function fetchPartial(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.text();
}

function updateNavForUser() {
  const user = getCurrentUser();
  if (!user) return;
  // 관리자 버튼 토글
  if (btnAdmin) {
    if (user.role === 'admin') btnAdmin.classList.remove('d-none');
    else btnAdmin.classList.add('d-none');
  }
}

async function loadView(path, activeBtnId) {
  // 챗봇 접근 제한: 게스트(SSAFY) 계정에서는 열리지 않음
  const user = getCurrentUser();
  if (path === VIEW.chatbot && user && user.nickname === 'SSAFY') {
    alert('게스트 계정은 챗봇을 사용할 수 없습니다.');
    return;
  }
  // 관리자 페이지 접근 제한
  if (path === VIEW.admin && user && user.role !== 'admin') {
    alert('관리자 권한이 필요합니다.');
    return;
  }
  if (isTransitioning) return;
  isTransitioning = true;
  // 이전 페이지 정리
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch { }
    currentCleanup = null;
  }
  // slide-out
  mainUI.classList.add('slide-out-right');
  await new Promise(resolve => {
    mainUI.addEventListener('animationend', resolve, { once: true });
  });
  mainUI.classList.remove('slide-out-right');
  // 교체
  try {
    const html = await fetchPartial(path);
    mainUI.innerHTML = html;
  } catch (e) {
    console.error(e);
    mainUI.innerHTML = `<div class="p-3 text-danger">Failed to load: ${path}</div>`;
  }
  // slide-in
  mainUI.classList.add('slide-in-left');
  await new Promise(resolve => {
    mainUI.addEventListener('animationend', resolve, { once: true });
  });
  mainUI.classList.remove('slide-in-left');
  isTransitioning = false;
  setActive(activeBtnId);
  updateNavForUser();
  refreshGreeting();
  // 페이지별 init 실행
  currentCleanup = routeInit(mainUI);
}

// 라우트 디스패처 - 현재 로드된 partial의 루트/요소 존재여부로 페이지 판별
function routeInit(root) {
  if (root.querySelector('#weather-page')) return WeatherPage.init(root);
  if (root.querySelector('#portfolio')) return PortfolioPage.init(root);
  if (root.querySelector('#log-page')) return LogPage.init(root);
  if (root.querySelector('#chatbot-page')) return ChatbotPage.init(root);
  if (root.querySelector('#profile-list')) return ProfilePage.init(root);
  if (root.querySelector('#login-form')) return LoginPage.init(root);
  if (root.querySelector('#signup-form')) return SignupPage.init(root);
  if (root.querySelector('#settings-page')) return SettingsPage.init(root);
  if (root.querySelector('#admin-page')) return AdminPage.init(root);
  // 기본은 home
  return HomePage.init(root);
}

document.addEventListener('DOMContentLoaded', () => {
  // 초기 로드: 홈
  loadView(VIEW.home, 'btn-home');
  // 네비 버튼 바인딩
  btnWeather?.addEventListener('click', () => loadView(VIEW.weather, 'btn-weather'));
  btnMyPage?.addEventListener('click', () => loadView(VIEW.mypage, 'btn-mypage'));
  btnLogs?.addEventListener('click', () => loadView(VIEW.logs, 'btn-logs'));
  btnChatbot?.addEventListener('click', () => loadView(VIEW.chatbot, 'btn-chatbot'));
  btnProfile?.addEventListener('click', () => loadView(VIEW.profile, 'btn-profile'));
  btnSettings?.addEventListener('click', () => loadView(VIEW.settings, 'btn-settings'));
  btnAdmin?.addEventListener('click', () => loadView(VIEW.admin, 'btn-admin'));
  btnHome?.addEventListener('click', () => loadView(VIEW.home, 'btn-home'));
});

// 전역에서 접근 가능한 SPA 객체 노출
window.SPA = { loadView, VIEW };