// signup.js
//
// 회원가입 페이지의 초기화 로직입니다. 입력된 이메일에 대해
// Firebase Authentication의 fetchSignInMethodsForEmail()을 호출하여
// 중복 여부를 실시간으로 확인하고, 회원가입이 완료되면 자동으로
// 로그인 상태가 되어 홈 화면으로 이동합니다.

import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

export const SignupPage = (() => {
  function init(root) {
    const form = root.querySelector('#signup-form');
    const nicknameEl = root.querySelector('#signup-nickname');
    const emailEl = root.querySelector('#signup-email');
    const pwEl = root.querySelector('#signup-password');
    const submitBtn = root.querySelector('#signup-submit');
    const errorEl = root.querySelector('#signup-error');
    const hintEl = root.querySelector('#email-hint');
    let validEmail = false;

    async function checkEmail() {
      const email = (emailEl?.value || '').trim();
      if (!email) {
        validEmail = false;
        if (hintEl) hintEl.textContent = '';
        submitBtn.disabled = true;
        return;
      }
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length) {
          if (hintEl) hintEl.textContent = '이미 등록된 이메일입니다.';
          validEmail = false;
        } else {
          if (hintEl) hintEl.textContent = '사용 가능한 이메일입니다.';
          validEmail = true;
        }
      } catch (err) {
        if (hintEl) hintEl.textContent = '이메일 확인 실패';
        validEmail = false;
      }
      // 버튼 활성화 조건: 모든 필수 입력 + 이메일 사용 가능
      const ready = validEmail && nicknameEl?.value.trim() && pwEl?.value.trim();
      submitBtn.disabled = !ready;
    }

    emailEl?.addEventListener('input', checkEmail);
    nicknameEl?.addEventListener('input', () => {
      const ready = validEmail && nicknameEl.value.trim() && pwEl.value.trim();
      submitBtn.disabled = !ready;
    });
    pwEl?.addEventListener('input', () => {
      const ready = validEmail && nicknameEl.value.trim() && pwEl.value.trim();
      submitBtn.disabled = !ready;
    });

    const submitHandler = async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = 'none';
      submitBtn.disabled = true;
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), pwEl.value.trim());
        // displayName 설정
        await updateProfile(userCred.user, { displayName: nicknameEl.value.trim() });
        // Firestore에 사용자 메타데이터 저장
        await setDoc(doc(db, 'users', userCred.user.uid), {
          nickname: nicknameEl.value.trim(),
          role: 'user',
          email: emailEl.value.trim(),
          backgroundURL: ''
        });
        // 자동 로그인 상태이므로 홈 화면으로 이동
        import('./auth.js').then(({ goHomeHard }) => goHomeHard());
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = '회원가입 실패: ' + (err.code || err.message);
          errorEl.style.display = 'block';
        }
        submitBtn.disabled = false;
      }
    };
    form?.addEventListener('submit', submitHandler);
    return () => {
      emailEl?.removeEventListener('input', checkEmail);
      form?.removeEventListener('submit', submitHandler);
    };
  }
  return { init };
})();