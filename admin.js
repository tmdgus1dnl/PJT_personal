// admin.js
//
// 관리자 메뉴 페이지 모듈입니다. 현재 로그인한 사용자가 관리자 권한을
// 가지고 있는 경우 전체 사용자 목록을 조회하고 각 사용자의 역할을
// 변경할 수 있습니다. 권한이 없는 경우 접근할 수 없습니다.

import { getCurrentUser } from './auth.js';
import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

export const AdminPage = (() => {
  async function loadUsers(root) {
    const tableBody = root.querySelector('#user-table');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement('tr');
      const role = data.role || 'user';
      tr.innerHTML = `
        <td>${data.nickname || ''}</td>
        <td>${data.email || ''}</td>
        <td>${role}</td>
        <td></td>
      `;
      // 동작 버튼 생성
      const btnCell = tr.lastElementChild;
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (role === 'admin' ? 'btn-danger' : 'btn-success');
      btn.textContent = role === 'admin' ? '권한 해제' : '권한 부여';
      btn.addEventListener('click', async () => {
        try {
          const newRole = role === 'admin' ? 'user' : 'admin';
          await updateDoc(doc(db, 'users', docSnap.id), { role: newRole });
          // 즉시 UI 갱신
          btn.className = 'btn btn-sm ' + (newRole === 'admin' ? 'btn-danger' : 'btn-success');
          btn.textContent = newRole === 'admin' ? '권한 해제' : '권한 부여';
          tr.children[2].textContent = newRole;
        } catch (err) {
          console.error('권한 변경 실패', err);
          alert('권한을 변경하지 못했습니다.');
        }
      });
      btnCell.appendChild(btn);
      tableBody.appendChild(tr);
    });
  }
  function init(root) {
    const user = getCurrentUser();
    const msgEl = root.querySelector('#admin-message');
    const contentEl = root.querySelector('#admin-content');
    if (!user || user.role !== 'admin') {
      if (msgEl) {
        msgEl.textContent = '관리자 권한이 필요합니다.';
        msgEl.classList.remove('d-none');
      }
      contentEl?.classList.add('d-none');
      return () => {};
    }
    // 권한 있음
    msgEl?.classList.add('d-none');
    contentEl?.classList.remove('d-none');
    loadUsers(root).catch((err) => {
      console.error('사용자 목록 로드 실패', err);
      if (msgEl) {
        msgEl.textContent = '사용자 목록을 불러오지 못했습니다.';
        msgEl.classList.remove('d-none');
      }
      contentEl?.classList.add('d-none');
    });
    return () => {
      // 특별한 클린업 없음 (테이블은 페이지 교체 시 제거됨)
    };
  }
  return { init };
})();