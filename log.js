// logs.js
import { firebaseConfig } from './firebase.js';

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import {
    getFirestore, collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

/* -------------------- Firebase -------------------- */
function ensureApp() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/* -------------------- Utils -------------------- */
function ts(d) { // Date -> 'YYYY-MM-DD hh:mm:ss'
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/** Event=value에서 value만 추출 (top-level/객체/문자열 모두 대응) */
function getEventValue(row) {
  // 1) top-level
  if (row && row.Event != null && row.Event !== '') return String(row.Event);

  // 2) message가 객체 형태
  const msg = row?.[FIELD.message];
  if (msg && typeof msg === 'object' && msg.Event != null && msg.Event !== '') {
    return String(msg.Event);
  }

  // 3) message가 문자열: "Event=Something ..." 패턴 파싱
  if (typeof msg === 'string' && msg) {
    const m = msg.match(/(?:^|\s)Event\s*=\s*([^\s]+)/i);
    if (m && m[1]) return m[1];
  }
  return '';
}

/* -------------------- Field Map -------------------- */
/* 필드명이 다르면 여기만 바꾸면 됨 */
const FIELD = {
    createdAt: 'createdAt',  // Firestore Timestamp
    level: 'level',      // 'INFO' | 'WARN' | 'WARNING' | 'ERROR'
    user: 'user',       // string
    message: 'message',    // string
};

/* =================================================== */
/*                       LogPage                       */
/* =================================================== */
export const LogPage = (() => {
    let unsub = null;

    const state = {
        qText: '',
        levels: new Set(['INFO', 'WARN', 'CRITICAL']), // 기본 모두 ON
        user: '',
        range: '24h',   // '1h' | '24h' | '7d' | 'custom'
        from: null,     // string (datetime-local)
        to: null,       // string (datetime-local)
        limit: 500,
    };

    // DOM refs
    let $body, $search, $lvInfo, $lvWarn, $lvError, $user, $range, $from, $to, $donut, $userList;

    /* -------------------- Range helpers -------------------- */
    function getRange() {
        if (state.range !== 'custom') {
            const now = new Date();
            const to = now;
            const from = new Date(now);
            if (state.range === '1h') from.setHours(now.getHours() - 1);
            if (state.range === '24h') from.setDate(now.getDate() - 1);
            if (state.range === '7d') from.setDate(now.getDate() - 7);
            return { from, to };
        }
        return {
            from: state.from ? new Date(state.from) : null,
            to: state.to ? new Date(state.to) : null
        };
    }

    /* -------------------- Query builder -------------------- */
    function buildQuery(db) {
        const col = collection(db, 'telematics_logs'); // ← 컬렉션명
        const clauses = [];

        const { from, to } = getRange();
        if (from) clauses.push(where(FIELD.createdAt, '>=', from));
        if (to) clauses.push(where(FIELD.createdAt, '<=', to));
        if (state.user) clauses.push(where(FIELD.user, '==', state.user));

        // 레벨 필터: 전부 체크면 생략, 일부만 체크면 'in' 사용
        const lv = Array.from(state.levels);
        if (lv.length > 0 && lv.length < 3) clauses.push(where(FIELD.level, 'in', lv));

        clauses.push(orderBy(FIELD.createdAt, 'desc'), limit(state.limit));
        return query(col, ...clauses);
    }

    /* -------------------- Client-side text filter -------------------- */
    function applyTextFilter(docs) {
        const q = state.qText.trim().toLowerCase();
        if (!q) return docs;
        return docs.filter(r => {
            const hay = `${r[FIELD.message] ?? ''} ${r[FIELD.user] ?? ''}`.toLowerCase();
            return hay.includes(q);
        });
    }

    /* -------------------- Render -------------------- */
    function render(rows) {
        // 사용자 datalist
        const users = new Set();
        rows.forEach(r => { const u = r[FIELD.user]; if (u) users.add(u); });
        if ($userList) {
            $userList.innerHTML = Array.from(users).sort().map(u => `<option value="${u}">`).join('');
        }

        // 표
        $body.innerHTML = rows.map(r => {
            const levelRaw = (r[FIELD.level] || '').toUpperCase();
            const levelStd = (levelRaw === 'WARNING') ? 'WARN' : levelRaw; // 표준화
            const t = r[FIELD.createdAt]?.toDate ? ts(r[FIELD.createdAt].toDate()) : '';
            const u = r[FIELD.user] ?? '';
            // ⚠️ WARN/CRITICAL일 때 Event=value의 "value"를 우선 표시
            let msgText = '';
            if (levelStd === 'CRITICAL' || levelStd === 'WARN') {
                msgText = getEventValue(r) || '';
            }
            
            // fallback: 기존 message 전체 표시
            // else if (!msgText) {
            //     const rawMsg = r[FIELD.message];
            //     msgText = typeof rawMsg === 'string' ? rawMsg
            //             : (rawMsg && typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : '');
            // }

            const badge =
            (levelStd === 'CRITICAL') ? 'danger' :
            (levelStd === 'WARN')     ? 'warning' : 'success';

            return `
            <tr class="lv-row-${badge}">
                <td><span class="badge bg-${badge}">${levelStd}</span></td>
                <td class="text-mono">${t}</td>
                <td><span class="text-info-emphasis">user:</span> ${escapeHtml(u)}</td>
                <td>${escapeHtml(msgText)}</td>
            </tr>`;
        }).join('');

        // 도넛
        const counts = { INFO: 0, WARN: 0, ERROR: 0 };
        rows.forEach(r => {
            const raw = (r[FIELD.level] || '').toUpperCase();
            const key =
              raw === 'WARNING' || raw === 'WARN' ? 'WARN' :
              // CRITICAL/FATAL/ERROR/ERR 모두 ERROR 버킷으로
              (raw === 'CRITICAL' || raw === 'FATAL' || raw === 'ERROR' || raw === 'ERR') ? 'ERROR' :
              'INFO';

            if (counts[key] !== undefined) counts[key]++;
        });
        if ($donut) paintDonut($donut, counts);
    }

    function paintDonut(el, cnt) {
        if (!el) return;
        const total = (cnt.INFO || 0) + (cnt.WARN || 0) + (cnt.ERROR || 0) || 1;
        const pInfo = (cnt.INFO / total) * 100;
        const pWarn = (cnt.WARN / total) * 100;
        const pError = 100 - pInfo - pWarn;

        el.style.background = `conic-gradient(
      var(--log-info) 0 ${pInfo}%,
      var(--log-warn) ${pInfo}% ${pInfo + pWarn}%,
      var(--log-error) ${pInfo + pWarn}% 100%)`;
        el.setAttribute('aria-label', `INFO ${cnt.INFO} / WARN ${cnt.WARN} / CRITICAL ${cnt.ERROR}`);
    }

    /* -------------------- Subscribe -------------------- */
    function subscribe(db) {
        if (unsub) { unsub(); unsub = null; }
        const q = buildQuery(db);
        unsub = onSnapshot(q, (snap) => {
            const rows = [];
            snap.forEach(doc => rows.push(doc.data()));
            render(applyTextFilter(rows));
        }, (err) => {
            console.error('onSnapshot error:', err); // 인덱스 필요 오류 시 콘솔 링크 제공됨
        });
    }

    /* -------------------- Bind events -------------------- */
    function bind(root, db) {
        // 레퍼런스 연결
        $body = root.querySelector('#log-body');
        $search = root.querySelector('#log-search');
        $lvInfo = root.querySelector('#lv-info');
        $lvWarn = root.querySelector('#lv-warn');
        $lvError = root.querySelector('#lv-error');
        $user = root.querySelector('#log-user');
        $range = root.querySelector('#log-range');
        $from = root.querySelector('#from');
        $to = root.querySelector('#to');
        $donut = root.querySelector('#log-donut');
        $userList = root.querySelector('#user-list');

        // 초기 레벨 체크
        if ($lvInfo && $lvWarn && $lvError) {
            $lvInfo.checked = $lvWarn.checked = $lvError.checked = true;
        }

        // 검색(디바운스)
        let timer = null;
        $search?.addEventListener('input', () => {
            state.qText = $search.value;
            clearTimeout(timer);
            timer = setTimeout(() => subscribe(db), 180);
        });

        // 레벨 필터
        const updateLevels = () => {
            state.levels.clear();
            if ($lvInfo?.checked) state.levels.add('INFO');
            if ($lvWarn?.checked) state.levels.add('WARNING');
            if ($lvError?.checked) state.levels.add('CRITICAL');
            subscribe(db);
        };
        $lvInfo?.addEventListener('change', updateLevels);
        $lvWarn?.addEventListener('change', updateLevels);
        $lvError?.addEventListener('change', updateLevels);

        // 유저 필터
        $user?.addEventListener('change', () => {
            state.user = ($user.value || '').trim();
            subscribe(db);
        });

        // 기간 필터
        $range?.addEventListener('change', () => {
            state.range = $range.value;
            const custom = state.range === 'custom';
            $from?.classList.toggle('d-none', !custom);
            $to?.classList.toggle('d-none', !custom);
            subscribe(db);
        });
        $from?.addEventListener('change', () => { state.from = $from.value; subscribe(db); });
        $to?.addEventListener('change', () => { state.to = $to.value; subscribe(db); });
    }

    /* -------------------- Lifecycle -------------------- */
    function init(root) {
        const db = getFirestore(ensureApp());
        bind(root, db);
        subscribe(db);

        // cleanup
        return () => { if (unsub) unsub(); unsub = null; };
    }

    return { init };
})();