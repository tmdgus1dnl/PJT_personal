// login.js
//
// 로그인 페이지에 대한 초기화 로직을 제공합니다. 사용자가 이메일과
// 비밀번호를 입력하여 제출하면 Firebase Authentication을 통해
// 인증을 시도하고 성공 시 메인 화면으로 리디렉션합니다.

import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';

export const LoginPage = (() => {
  function init(root) {
    const form = root.querySelector('#login-form');
    const emailEl = root.querySelector('#login-email');
    const passEl = root.querySelector('#login-password');
    const errEl = root.querySelector('#login-error');
    const submitHandler = async (e) => {
      e.preventDefault();
      if (errEl) errEl.style.display = 'none';
      const email = emailEl?.value.trim();
      const pw = passEl?.value.trim();
      if (!email || !pw) return;
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      try {
        await signInWithEmailAndPassword(auth, email, pw);
        // 로그인 성공 시 SPA 홈 화면으로 이동
        window.SPA.loadView(window.SPA.VIEW.home, 'btn-home');
      } catch (err) {
        if (errEl) {
          errEl.textContent = '로그인 실패: ' + (err.code || err.message);
          errEl.style.display = 'block';
        }
      }
    };
    form?.addEventListener('submit', submitHandler);
    return () => {
      form?.removeEventListener('submit', submitHandler);
    };
  }
  return { init };
})();