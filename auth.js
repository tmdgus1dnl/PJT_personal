// auth.js
//
// Firebase 인증 상태를 모니터링하여 현재 로그인한 사용자의 정보를
// 관리하고 사이드바에 표시하는 모듈입니다. 이 모듈은 Firebase를
// 초기화하고 onAuthStateChanged를 구독하여 사용자의 로그인/로그아웃
// 이벤트를 감지합니다. 로그인하지 않은 경우에는 기본 SSAFY 계정을
// 가정하며, 해당 계정은 관리자 권한으로 모든 기능을 사용할 수
// 있지만 챗봇 접근이 제한됩니다.

import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

// Firebase 애플리케이션을 초기화한다. 이미 초기화된 경우에는 기존
// 인스턴스를 재사용한다.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 현재 사용자 정보를 저장하는 객체. 로그인하지 않은 경우 기본 SSAFY
// 계정 정보를 사용한다.
let currentUser = {
  uid: null,
  email: null,
  nickname: 'SSAFY',
  role: 'admin',
  backgroundURL: ''
};

/**
 * 사이드바의 표시 요소를 현재 사용자 정보에 맞게 업데이트한다.
 */
function updateGreeting() {
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    greetingEl.textContent = `안녕하세요! ${currentUser.nickname}님`;
  }
  // 프로필 원, 이름, 역할 업데이트
  const circle = document.querySelector('.profile-circle');
  const nameEl = document.querySelector('.sidebar-content strong');
  const roleEl = document.querySelector('.sidebar-content small');
  if (circle) {
    const initial = currentUser.nickname ? currentUser.nickname.charAt(0).toUpperCase() : 'S';
    circle.textContent = initial;
  }
  if (nameEl) nameEl.textContent = currentUser.nickname || 'SSAFY';
  if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? '관리자' : '일반 계정';
  // 배경 이미지 적용
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && currentUser.backgroundURL) {
    sidebar.style.backgroundImage = `url('${currentUser.backgroundURL}')`;
    sidebar.style.backgroundSize = 'cover';
    sidebar.style.backgroundPosition = 'center';
  }
}

/**
 * Firestore에서 사용자 메타데이터를 불러온다. 존재하지 않는 경우
 * 기본값을 반환한다.
 * @param {import('firebase/auth').User} user
 */
async function loadUserMetadata(user) {
  try {
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: user.uid,
        email: user.email,
        nickname: data.nickname || '사용자',
        role: data.role || 'user',
        photoURL: data.photoURL || '',
        backgroundURL: data.backgroundURL || ''
      };
    }
  } catch (err) {
    console.error('loadUserMetadata error', err);
  }
  // 기본값
  return {
    uid: user.uid,
    email: user.email,
    nickname: user.email,
    role: 'user',
    photoURL: '',
    backgroundURL: ''
  };
}

// 인증 상태 변화 감지. 로그인하면 사용자 메타데이터를 불러오고,
// 로그아웃하면 기본 SSAFY 계정으로 전환한다.
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = await loadUserMetadata(user);
  } else {
    currentUser = {
      uid: null,
      email: null,
      nickname: 'SSAFY',
      role: 'admin',
      backgroundURL: ''
    };
  }
  updateGreeting();
});

/**
 * 현재 사용자 객체를 반환한다. 로그인하지 않은 경우 기본 SSAFY
 * 계정을 반환한다.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * 현재 사용자를 로그아웃한다. 기본 SSAFY 계정으로 전환된다.
 */
export function signOutUser() {
  return signOut(auth);
}

export function onAuth(callback) {
  const auth = getAuth();
  return onAuthStateChanged(auth, callback);
}

// 하드 리로드로 홈 진입
export function goHomeHard() {
  // 프로젝트 루트가 바뀌어도 안전하게 main.html로 보냄
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/[^/]+$/, 'main.html');
  url.search = '';   // 캐시 무시하고 싶으면 `'?t='+Date.now()`도 가능
  url.hash   = '';
  window.location.replace(url.toString()); // 뒤로가기 스택 남기지 않음
}