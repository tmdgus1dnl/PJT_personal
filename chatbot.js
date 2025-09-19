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
  orderBy
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

// Firebase 초기화(로그 페이지와 동일 함수 활용)
function ensureApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const ChatbotPage = (() => {
  let rec = null;
  let recognizing = false;

  /**
   * Firebase에서 기존 대화 기록을 불러옵니다.
   * 로드된 메시지는 시간순으로 chat-area 요소에 추가됩니다.
   */
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

  /**
   * 채팅창에 메시지를 추가합니다.
   * role: 'user' | 'assistant'
   * text: 표시할 문자열
   * isLoading: 로딩 인디케이터 여부
   */
  function appendMessage(root, role, text, isLoading = false) {
    const area = root.querySelector('#chat-area');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="bubble ${isLoading ? 'loading' : ''}">
        ${text}
      </div>
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
   * OpenAI API를 호출하여 AI 응답을 가져옵니다.
   * 실제 구현에서는 서버 측에서 안전하게 API 키를 처리해야 합니다.
   */
  async function fetchAIResponse(userText) {
    // 예시: 1.5초 후에 사용자 입력을 포함한 응답을 반환
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return 'AI 응답 예시: "' + userText + '"에 대한 분석 결과입니다.';
  }

  /** 사용자의 입력을 처리합니다. */
  async function handleUserInput(root, text) {
    if (!text.trim()) return;
    appendMessage(root, 'user', text);
    await saveMessage('user', text);
    // 로딩 메시지를 먼저 추가합니다.
    const loadingMsg = appendMessage(root, 'assistant', '...응답 생성 중...', true);
    try {
      const aiResponse = await fetchAIResponse(text.trim());
      const bubble = loadingMsg.querySelector('.bubble');
      bubble.classList.remove('loading');
      bubble.textContent = aiResponse;
      await saveMessage('assistant', aiResponse);
      speakText(aiResponse);
    } catch (err) {
      const bubble = loadingMsg.querySelector('.bubble');
      bubble.classList.remove('loading');
      bubble.textContent = '응답을 불러오지 못했습니다.';
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
    // 전송 핸들러
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
    // 음성 인식 초기화 및 버튼 바인딩
    if (!rec) {
      rec = initSpeechRecognition(root);
    }
    const voiceHandler = () => {
      if (!rec) return;
      if (recognizing) {
        rec.stop();
      } else {
        rec.start();
      }
    };
    voiceBtn?.addEventListener('click', voiceHandler);
    // 대화 기록 로드
    loadHistory(root);
    // cleanup 함수 반환
    return () => {
      sendBtn?.removeEventListener('click', sendHandler);
      inputEl?.removeEventListener('keydown', sendHandler);
      voiceBtn?.removeEventListener('click', voiceHandler);
      if (rec && recognizing) rec.stop();
    };
  }
  return { init };
})();