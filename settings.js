// settings.js (교체본)
// - SPA 라우팅 호환
// - offAuth / nickInput 레퍼런스 에러 제거
// - 게스트(SSAFY)면 Log/Admin 버튼만 보이게

import { getCurrentUser, signOutUser } from './auth.js';
import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getAuth, onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { getFirestore, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

export const SettingsPage = (() => {
  function init(root) {
    // -------- DOM refs (항상 root 범위에서만) --------
    const msgEl           = root.querySelector('#settings-message');
    const nicknameForm    = root.querySelector('#nickname-form');
    const nicknameInput   = root.querySelector('#settings-nickname');
    const passwordForm    = root.querySelector('#password-form');
    const passwordInput   = root.querySelector('#settings-password');
    const backgroundForm  = root.querySelector('#background-form');
    const backgroundInput = root.querySelector('#settings-background');
    const logoutBtn       = root.querySelector('#btn-logout');

    // 관리자 전용 버튼 영역
    const adminBox        = root.querySelector('#admin-buttons');
    const btnLog          = root.querySelector('#btn-settings-log');
    const btnAdmin        = root.querySelector('#btn-settings-admin');

    // 이 페이지가 아닌 경우 조용히 종료
    if (!root.querySelector('#settings-page')) return null;

    // -------- Firebase 인스턴스 --------
    const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    // -------- 유틸/헬퍼 --------
    const toggleForms = (enabled, nodes) => {
      const { nicknameInput, passwordInput, backgroundInput, nicknameForm, passwordForm, backgroundForm } = nodes;
      [nicknameInput, passwordInput, backgroundInput].forEach(el => { if (el) el.disabled = !enabled; });
      if (nicknameForm)  nicknameForm.style.pointerEvents = enabled ? 'auto' : 'none';
      if (passwordForm)  passwordForm.style.pointerEvents = enabled ? 'auto' : 'none';
      if (backgroundForm)backgroundForm.style.pointerEvents = enabled ? 'auto' : 'none';
      // submit 버튼도 동기화
      root.querySelectorAll('#nickname-form button, #password-form button, #background-form button')
          .forEach(b => b.disabled = !enabled);
    };

    const showAdminButtons = (show) => {
      if (!adminBox) return;
      adminBox.classList.toggle('d-none', !show);
    };

    const showLogout = (show) => {
      if (!logoutBtn) return;
      logoutBtn.classList.toggle('d-none', !show);
    };

    // -------- 이벤트 핸들러 --------
    const handleNickname = async (e) => {
      e.preventDefault();
      const appUser = getCurrentUser();
      const newName = nicknameInput?.value?.trim();
      if (!appUser || !newName) return;
      try {
        await updateDoc(doc(db, 'users', appUser.uid), { nickname: newName });
        // 즉시 반영(새로고침 없이)
        window.applyImmediateNickname?.(newName);
        alert('닉네임이 변경되었습니다.');
      } catch (err) {
        console.error(err);
        alert('닉네임 변경에 실패했습니다.');
      }
    };

    const handlePassword = async (e) => {
      e.preventDefault();
      const newPw = passwordInput?.value?.trim();
      if (!newPw) return;
      try {
        const fbUser = auth.currentUser;
        if (!fbUser) throw new Error('로그인된 사용자가 없습니다.');
        await updatePassword(fbUser, newPw);
        alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
        await signOutUser();
        import('./auth.js').then(({ goHomeHard }) => goHomeHard());
      } catch (err) {
        console.error(err);
        alert('비밀번호 변경 실패. 재로그인 후 다시 시도하세요.');
      }
    };

    const handleBackground = async (e) => {
      e.preventDefault();
      const appUser = getCurrentUser();
      const file = backgroundInput?.files?.[0];
      if (!appUser || !file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        try {
          // 즉시 프리뷰
          window.applyImmediateBackground?.(dataUrl);
          // Firestore에 저장(프로젝트 정책에 따라 Storage 사용 가능)
          await updateDoc(doc(db, 'users', appUser.uid), { backgroundURL: dataUrl });
          alert('배경 이미지가 변경되었습니다.');
        } catch (err) {
          console.error(err);
          alert('배경 이미지 변경 실패');
        }
      };
      reader.readAsDataURL(file);
    };

    const handleLogout = async () => {
      try {
        await signOutUser();
        import('./auth.js').then(({ goHomeHard }) => goHomeHard());
      } catch (err) {
        console.error(err);
        alert('로그아웃에 실패했습니다.');
      }
    };

    // 바인딩
    nicknameForm?.addEventListener('submit', handleNickname);
    passwordForm?.addEventListener('submit', handlePassword);
    backgroundForm?.addEventListener('submit', handleBackground);
    logoutBtn?.addEventListener('click', handleLogout);

    btnLog?.addEventListener('click', () => {
      window.SPA?.loadView(window.SPA?.VIEW.logs, 'btn-logs', (r) =>
        window.LogPage?.init?.(r)
      );
    });
    btnAdmin?.addEventListener('click', () => {
      const adminSection = root.querySelector('#admin-section');
      if (adminSection) {
        adminSection.style.display = '';
        adminSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.SPA?.loadView(window.SPA?.VIEW.admin, 'btn-settings', (r) =>
          window.AdminPage?.init?.(r)
        );
      }
    });

    // -------- 인증 상태 반영 (구독) --------
    let offAuth = onAuthStateChanged(auth, async (fbUser) => {
      const nodes = { nicknameInput, passwordInput, backgroundInput, nicknameForm, passwordForm, backgroundForm };

      if (fbUser) {
        // 우리 앱의 사용자 메타(닉네임/role)는 getCurrentUser()로
        const appUser = getCurrentUser();
        if (nicknameInput && appUser?.nickname) nicknameInput.value = appUser.nickname;

        // 기본값: 일반 사용자
        toggleForms(true, nodes);
        showAdminButtons(false);
        showLogout(true);
        if (msgEl) msgEl.classList.add('d-none');

        // 관리자인 경우(SSAFY 포함) → 관리자 버튼 표시, 로그아웃 숨김(정책에 맞게)
        if (appUser?.role === 'admin') {
          showAdminButtons(true);
          showLogout(false);
        }
      } else {
        // 게스트(SSAFY 기본 보기)
        toggleForms(false, nodes);
        showAdminButtons(true);  // Log/Admin만
        showLogout(false);
        if (msgEl) {
          msgEl.textContent = '기본 계정은 닉네임, 비밀번호, 배경화면 변경이 불가합니다.';
          msgEl.classList.remove('d-none');
        }
      }
    });

    // -------- cleanup --------
    return () => {
      nicknameForm?.removeEventListener('submit', handleNickname);
      passwordForm?.removeEventListener('submit', handlePassword);
      backgroundForm?.removeEventListener('submit', handleBackground);
      logoutBtn?.removeEventListener('click', handleLogout);
      btnLog?.replaceWith?.(btnLog.cloneNode(true));
      btnAdmin?.replaceWith?.(btnAdmin.cloneNode(true));
      if (offAuth) { offAuth(); offAuth = null; }
    };
  }

  return { init };
})();