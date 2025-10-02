// profile.js
//
// 프로필 선택 페이지를 위한 모듈입니다. Firestore의 users 컬렉션을
// 읽어서 사용자 목록을 표시하고, 선택된 계정에 따라 로그인 또는
// 기본 계정 전환을 처리합니다. 새 프로필 추가 버튼을 클릭하면
// 회원가입 화면으로 이동합니다.

import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { getCurrentUser } from './auth.js';

export const ProfilePage = (() => {
  /**
   * Firestore에서 사용자 목록을 조회하여 프로필 리스트를 렌더링합니다.
   * 기본 SSAFY 계정은 리스트 최상단에 표시합니다.
   * @param {HTMLElement} root 루트 요소
   */
  async function loadProfiles(root) {
    const list = root.querySelector('#profile-list');
    if (!list) return;
    list.innerHTML = '';
    // 기본 SSAFY 항목
    const defaultItem = document.createElement('button');
    defaultItem.type = 'button';
    defaultItem.className = 'list-group-item list-group-item-action';
    defaultItem.textContent = 'SSAFY (게스트 계정)';
    defaultItem.addEventListener('click', () => {
      // 로그아웃하여 게스트 계정으로 전환
      import('./auth.js').then(({ signOutUser }) => {
        signOutUser().then(() => {
          window.SPA.loadView(window.SPA.VIEW.home, 'btn-home');
        });
      });
    });
    list.appendChild(defaultItem);

    // Firestore 사용자 목록
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    try {
      const col = collection(db, 'users');
      const snap = await getDocs(col);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        // SSAFY 계정은 기본 항목으로 대체되므로 스킵
        if (data.nickname === 'SSAFY') return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-group-item list-group-item-action';
        const roleStr = data.role === 'admin' ? '관리자' : '사용자';
        btn.textContent = `${data.nickname} (${roleStr})`;
        btn.addEventListener('click', () => {
          // 현재 로그인된 사용자가 선택한 계정과 동일하면 홈으로 돌아감
          const cur = getCurrentUser();
          if (cur.uid === docSnap.id) {
            window.SPA.loadView(window.SPA.VIEW.home, 'btn-home');
          } else {
            // 세션에 선택한 사용자 ID 저장 후 로그인 화면으로 이동
            sessionStorage.setItem('selectedUserId', docSnap.id);
            window.SPA.loadView(window.SPA.VIEW.login, 'btn-profile');
          }
        });
        list.appendChild(btn);
      });
    } catch (err) {
      console.error('프로필 목록을 불러오지 못했습니다.', err);
      list.innerHTML = '<div class="text-danger">프로필 목록을 불러오지 못했습니다.</div>';
    }
  }

  function init(root) {
    loadProfiles(root);
    const addBtn = root.querySelector('#add-profile');
    addBtn?.addEventListener('click', () => {
      window.SPA.loadView(window.SPA.VIEW.signup, 'btn-profile');
    });
    return () => {
      // 리스트 항목에 바인딩된 이벤트는 페이지 교체 시 DOM이 제거되므로 별도 해제 불필요
    };
  }

  return { init };
})();