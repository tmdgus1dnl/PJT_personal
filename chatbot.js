// chatbot.js
//
// AI 챗봇 페이지를 위한 모듈입니다. 기존 프로젝트에서 HomePage, WeatherPage,
// PortfolioPage, LogPage와 유사한 형태로 사용하기 위해 export 형태를 맞췄습니다.
//
// 이 모듈은 다음 기능을 제공합니다:
// 1. 사용자가 텍스트를 입력하고 전송하면 채팅창에 즉시 표시합니다.
// 2. 음성 입력 버튼을 누르면 Chrome Speech API를 호출하여 음성을 텍스트로 변환하고
//    결과를 대화에 삽입합니다. 인식 중에는 버튼에 활성 애니메이션을 부여하고
//    “듣고 있어요…” 상태 문구를 표시합니다.
// 3. OpenAI API를 비동기로 호출하여 AI 응답을 받아오고, 로딩 인디케이터를 표시한 후
//    채팅창에 AI 말풍선으로 추가합니다. (실제 API 호출은 시연 목적이며 서버에서
//    proxy 함수를 구현해야 합니다.)
// 4. 응답과 사용자 입력을 Firebase Firestore에 저장하여 대화 기록을 유지할 수
//    있도록 합니다. (선택 사항이며 Firebase 초기화가 필요합니다.)
// 5. 응답을 받은 후 speechSynthesis API를 사용해 AI의 메시지를 음성으로 읽어줍니다.

import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,              // ✅ limit 추가
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

const API_BASE = "http://localhost:8080";

// 대화 맥락(누적)
const messages = [
  { role: "system", content: "You are a helpful assistant." }
];

// Firebase 초기화(로그 페이지와 동일 함수 활용)
function ensureApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Firestore에서 최근 telematics 로그 메시지를 가져와 시스템 컨텍스트로 사용.
 * - 상위 20개 (createdAt desc)
 * - 각 라인 포맷: ISO_TIMESTAMP | RAW_MESSAGE
 */
async function fetchLogsForContext() {
  try {
    const db = getFirestore(ensureApp());
    const col = collection(db, 'telematics_logs');
    const qy = query(col, orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(qy);

    const lines = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const ts = data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : "";
      const msg = data?.message;
      let text = "";
      if (typeof msg === 'string') text = msg;
      else if (msg && typeof msg === 'object') text = JSON.stringify(msg);
      if (text) lines.push(`${ts} | ${text}`);
    });

    return lines; // 최신이 위(내림차순)
  } catch (err) {
    console.error('Failed to fetch logs for context:', err);
    return [];
  }
}

export const ChatbotPage = (() => {
  let rec = null;
  let recognizing = false;

  /** Firebase에서 기존 대화 기록을 불러옵니다. */
  async function loadHistory(root) {
    try {
      const db = getFirestore(ensureApp());
      const col = collection(db, 'chat_messages');
      const q = query(col, orderBy('timestamp', 'asc'));
      const snap = await getDocs(q);
      snap.forEach((doc) => {
        const { role, content } = doc.data();
        appendMessage(root, role, content);
      });
      scrollToBottom(root);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }

  /** Firebase에 메시지를 저장합니다. */
  async function saveMessage(role, content) {
    try {
      const db = getFirestore(ensureApp());
      await addDoc(collection(db, 'chat_messages'), {
        role,
        content,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  }

  /** 채팅창에 메시지를 추가합니다. */
  function appendMessage(root, role, text, isLoading = false) {
    const area = root.querySelector('#chat-area');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="bubble ${isLoading ? 'loading' : ''}">${text}</div>
    `;
    area.appendChild(msgDiv);
    scrollToBottom(root);
    return msgDiv;
  }

  /** 가장 최근 메시지가 보이도록 스크롤을 내립니다. */
  function scrollToBottom(root) {
    const area = root.querySelector('#chat-area');
    area.scrollTop = area.scrollHeight;
  }

  /**
   * OpenAI 백엔드 프록시 호출: messages 배열을 받아 그대로 전송
   */
  async function fetchAIResponse(msgsToSend) {
    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgsToSend ?? messages }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`API 호출 실패: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    return data.content ?? "";
  }

  /** 사용자의 입력을 처리합니다. */
  async function handleUserInput(root, text) {
    const userText = text.trim();
    if (!userText) return;

    // 1) 사용자 말풍선
    appendMessage(root, 'user', userText);

    // 2) 대화 맥락에 user 누적
    messages.push({ role: 'user', content: userText });

    // 3) (선택) Firebase 저장
    await saveMessage('user', userText);

    // 4) 로딩 말풍선
    const loadingMsg = appendMessage(root, 'assistant', '...응답 생성 중...', true);

    try {
      // 5) 주행데이터 로그 컨텍스트 구성
      const logLines = await fetchLogsForContext();

      // ✨ 가독성 지침: 모델 출력 형식 고정
      const formatSystemMsg = {
        role: 'system',
        content: [
          '출력 형식(한국어, 표 금지):',
          '1) TL;DR: 한 줄 요약.',
          '2) 주요 이벤트(최대 6개): • 불릿, 각 항목 15자 이내.',
          '3) 핵심 수치(최대 8줄): 항목: 값',
          '4) 권장 조치(최대 5개): ☐ 체크박스 불릿',
          '규칙: 과도한 서술 금지, 줄 사이 한 줄 띄우기, 불필요한 접속사/중복 제거.',
        ].join('\n')
      };
      // 모델이 "주행/텔레매틱스 데이터"로 명확히 인식하도록 지시하는 시스템 프롬프트
      const sysHeader = [
        "당신은 차량 텔레매틱스/주행데이터 분석 보조입니다.",
        "아래 LOG_CONTEXT는 Firestore 'telematics_logs' 컬렉션에서 최근 20개의 주행데이터 메시지를 시간 내림차순으로 가져온 것입니다.",
        "각 라인의 포맷: ISO_TIMESTAMP | RAW_MESSAGE",
        "답변 시 가능한 한 LOG_CONTEXT에 포함된 사실만 근거로 사용하세요.",
        "LOG_CONTEXT에 없는 값은 추정하지 말고, 부족하다고 명시하세요.",
        "수치/이벤트 요약이나 파이프라인 제안이 필요하면 LOG_CONTEXT 범위 내에서만 처리하세요.",
      ].join("\n");

      const logsSystemMsg = logLines.length > 0
        ? { role: 'system', content: `${sysHeader}\n\nLOG_CONTEXT:\n${logLines.join('\n')}` }
        : null;

      // 6) 보낼 메시지 구성: (기존 system들) + (로그 system) + (나머지 대화)
      const systemMsgs = messages.filter(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');

      // const sendMsgs = logsSystemMsg
      //   ? [...systemMsgs, logsSystemMsg, ...nonSystemMsgs]
      //   : [...systemMsgs, ...nonSystemMsgs];
      const sendMsgs = logsSystemMsg
      ? [...systemMsgs, logsSystemMsg, formatSystemMsg, ...nonSystemMsgs]
      : [...systemMsgs, formatSystemMsg, ...nonSystemMsgs];


      // 7) GPT 호출
      const aiResponse = await fetchAIResponse(sendMsgs);

      // 8) 로딩 제거 + 실제 텍스트 반영
      const bubble = loadingMsg.querySelector('.bubble');
      bubble.classList.remove('loading');
      bubble.textContent = aiResponse;

      // 9) 대화 맥락에 assistant 누적
      messages.push({ role: 'assistant', content: aiResponse });

      // 10) (선택) 저장
      await saveMessage('assistant', aiResponse);

      // 11) 읽어주기
      speakText(aiResponse);
    } catch (err) {
      const bubble = loadingMsg.querySelector('.bubble');
      bubble.classList.remove('loading');
      bubble.textContent = '응답을 불러오지 못했습니다.';
      console.error(err);
    }
  }

  /** 브라우저 TTS로 텍스트를 읽어줍니다. */
  function speakText(text) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    window.speechSynthesis.speak(utterance);
  }

  /** 음성 인식 객체를 초기화하고 이벤트를 설정합니다. */
  function initSpeechRecognition(root) {
    const VoiceRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!VoiceRecognition) return null;
    const recognizer = new VoiceRecognition();
    recognizer.lang = 'ko-KR';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    const voiceBtn = root.querySelector('#voice-button');
    const statusDiv = document.createElement('div');
    statusDiv.className = 'voice-status text-secondary fst-italic mt-1';
    voiceBtn.after(statusDiv);
    recognizer.onstart = () => {
      recognizing = true;
      voiceBtn.classList.add('active');
      statusDiv.textContent = '듣고 있어요...';
    };
    recognizer.onend = () => {
      recognizing = false;
      voiceBtn.classList.remove('active');
      statusDiv.textContent = '';
    };
    recognizer.onerror = (e) => {
      console.error('음성 인식 오류:', e);
    };
    recognizer.onresult = (e) => {
      const result = e.results[0][0].transcript;
      handleUserInput(root, result);
    };
    return recognizer;
  }

  /** 페이지 초기화 함수. root는 로드된 chatbot.html의 루트 요소입니다. */
  function init(root) {
    const inputEl = root.querySelector('#chat-input');
    const sendBtn = root.querySelector('#send-button');
    const voiceBtn = root.querySelector('#voice-button');

    const sendHandler = () => {
      const text = inputEl.value;
      inputEl.value = '';
      handleUserInput(root, text);
    };
    sendBtn?.addEventListener('click', sendHandler);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendHandler();
      }
    });

    if (!rec) {
      rec = initSpeechRecognition(root);
    }
    const voiceHandler = () => {
      if (!rec) return;
      if (recognizing) rec.stop();
      else rec.start();
    };
    voiceBtn?.addEventListener('click', voiceHandler);

    loadHistory(root);

    return () => {
      sendBtn?.removeEventListener('click', sendHandler);
      inputEl?.removeEventListener('keydown', sendHandler);
      voiceBtn?.removeEventListener('click', voiceHandler);
      if (rec && recognizing) rec.stop();
    };
  }

  return { init };
})();