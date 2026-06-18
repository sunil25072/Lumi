/* ============================================================
   LUMI AI — script.js   Clean Light Theme
   ============================================================ */

'use strict';

/* ── CONFIG ────────────────────────────────────────────────── */
const API_BASE = 'http://localhost:5001/api';

/* ── DOM ────────────────────────────────────────────────────── */
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const imgBtn = document.getElementById('imgBtn');
const fileInput = document.getElementById('fileInput');
const userInput = document.getElementById('userInput');
const messages = document.getElementById('messages');
const feed = document.getElementById('feed');
const welcome = document.getElementById('welcome');
const charHint = document.getElementById('charHint');
const newChatBtn = document.getElementById('newChatBtn');
const burger = document.getElementById('burger');
const overlay = document.getElementById('overlay');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('historyList');
const topbarTitle = document.getElementById('topbarTitle');

/* ── State ──────────────────────────────────────────────────── */
let isTyping = false;
let convStarted = false;
let currentConvId = null;
let conversations = [];
let currentAudio = null;

// STT State
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Load from local storage on init
const saved = localStorage.getItem('lumi_conversations');
if (saved) {
    try {
        conversations = JSON.parse(saved);
    } catch (e) {
        console.error("Failed to parse saved conversations", e);
        conversations = [];
    }
}

/* ── Helpers ────────────────────────────────────────────────── */
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderMd(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>')
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n/g, '<br>');
}

function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollBottom() {
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
}

function hideWelcome() {
    welcome.classList.add('hidden');
}

function saveToLocalStorage() {
    localStorage.setItem('lumi_conversations', JSON.stringify(conversations));
}

/* ── Append message ─────────────────────────────────────────── */
function appendMsg(role, text, skipSave = false, imageUrl = null, customTime = null) {
    hideWelcome();

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const time = customTime || now();

    let contentHtml = '';
    if (imageUrl) {
        // Medium size image
        contentHtml += `<img src="${imageUrl}" class="msg-img" style="max-width:320px; border-radius:8px; margin-bottom:8px; display:block;">`;
    }
    contentHtml += role === 'ai' ? renderMd(text) : esc(text).replace(/\n/g, '<br>');

    if (role === 'ai') {
        row.innerHTML = `
      <div class="ai-avatar">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="msg-wrap">
        <div class="bubble">${contentHtml}</div>
        <div class="msg-meta">
            Lumi · ${time}
            <button class="tts-btn" title="Listen to message">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
            </button>
        </div>
      </div>`;

        const ttsBtn = row.querySelector('.tts-btn');
        ttsBtn.addEventListener('click', () => playTts(text, ttsBtn));

    } else {
        row.innerHTML = `
      <div class="msg-wrap">
        <div class="bubble">${contentHtml}</div>
        <div class="msg-meta">You · ${time}</div>
      </div>`;
    }

    messages.appendChild(row);

    if (role === 'ai' && !skipSave) {
        // Scroll to the start of the message so the user sees from the "1st"
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        scrollBottom();
    }

    // Save message to state
    if (!skipSave && currentConvId) {
        const conv = conversations.find(c => c.id === currentConvId);
        if (conv) {
            conv.messages.push({ role, text, time, imageUrl });
            saveToLocalStorage();
        }
    }
}

/* ── TTS Playback ───────────────────────────────────────────── */
async function playTts(text, btn) {
    if (btn.classList.contains('playing')) {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        btn.classList.remove('playing');
        return;
    }

    // Stop existing audio
    if (currentAudio) {
        currentAudio.pause();
        document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('playing'));
    }

    btn.classList.add('playing');

    try {
        const response = await fetch(`${API_BASE}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'TTS Failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        currentAudio = new Audio(url);
        currentAudio.play();

        currentAudio.onended = () => {
            btn.classList.remove('playing');
            currentAudio = null;
        };

    } catch (error) {
        console.error('TTS Error:', error);
        btn.classList.remove('playing');
        showLumiAlert("Sorry, I couldn't generate audio right now. " + error.message);
    }
}

/* ── Voice Recording (STT) ──────────────────────────────────── */
async function toggleMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showLumiAlert('Microphone not supported on this device.');
        console.warn('getUserMedia not available');
        return;
    }
    if (isRecording) {
        console.log('Stopping recording');
        stopRecording();
    } else {
        console.log('Starting recording');
        startRecording();
    }
}

async function startRecording() {
    // Verify MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
        showLumiAlert('Your browser does not support audio recording.');
        console.warn('MediaRecorder not available');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await sendAudioToStt(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('recording');
        userInput.placeholder = "Listening...";
    } catch (err) {
        console.error("Mic Error:", err);
        showLumiAlert("Could not access microphone. Please check permissions.");
        console.error('Mic permission error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('recording');
        userInput.placeholder = "Ask Lumi anything...";
    }
}

async function sendAudioToStt(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    userInput.value = "Transcribing...";
    userInput.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/stt`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.transcript) {
            userInput.value = data.transcript;
            userInput.disabled = false;
            syncInput();
            userInput.focus();
        } else {
            userInput.value = "";
            userInput.disabled = false;
            userInput.placeholder = "Sorry, couldn't hear that. Try again.";
        }
    } catch (err) {
        console.error("STT Error:", err);
        userInput.value = "";
        userInput.disabled = false;
        showLumiAlert("Transcription failed.");
    }
}

/* ── Vision Analysis ────────────────────────────────────────── */
imgBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await sendImageToVision(file);
    fileInput.value = ''; // Reset
});

async function sendImageToVision(file) {
    const formData = new FormData();
    formData.append('image', file);

    const localImgUrl = URL.createObjectURL(file);

    if (!convStarted) {
        addHistoryItem("Image Analysis");
        convStarted = true;
    }

    appendMsg('user', "Analyze this image", false, localImgUrl);
    showTyping();

    try {
        const response = await fetch(`${API_BASE}/analyze-image`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        removeTyping();

        if (data.description) {
            appendMsg('ai', data.description);
        } else {
            appendMsg('ai', "I couldn't describe this image. " + (data.error || ''));
        }
    } catch (err) {
        console.error("Vision Error:", err);
        removeTyping();
        appendMsg('ai', "Error connecting to image analysis service.");
    }
}

/* ── Typing indicator ───────────────────────────────────────── */
function showTyping() {
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typingRow';
    row.innerHTML = `
    <div class="ai-avatar">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="msg-wrap">
      <div class="bubble" style="padding:12px 18px;">
        <div class="typing-dots">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
      </div>
    </div>`;
    messages.appendChild(row);
    scrollBottom();
}

function removeTyping() {
    const r = document.getElementById('typingRow');
    if (r) r.remove();
}

/* ── Sidebar history ────────────────────────────────────────── */
function renderHistory() {
    historyList.innerHTML = '';
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'history-item' + (conv.id === currentConvId ? ' active' : '');
        item.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${conv.label}</span>
        <button class="del-chat-btn" title="Delete chat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
          </svg>
        </button>`;

        item.addEventListener('click', (e) => {
            // Don't load if clicking the delete button
            if (e.target.closest('.del-chat-btn')) return;
            loadConversation(conv.id);
        });

        const delBtn = item.querySelector('.del-chat-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(conv.id);
        });

        historyList.appendChild(item);
    });
}

let deleteTargetId = null;

function deleteConversation(id) {
    deleteTargetId = id;
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function addHistoryItem(text) {
    const label = text.length > 34 ? text.slice(0, 34) + '…' : text;
    topbarTitle.textContent = label;

    const newId = Date.now().toString();
    currentConvId = newId;

    conversations.unshift({
        id: newId,
        label: label,
        messages: []
    });

    renderHistory();
    saveToLocalStorage();
}

function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    currentConvId = id;
    convStarted = true;
    topbarTitle.textContent = conv.label;

    messages.innerHTML = '';
    if (conv.messages.length === 0) {
        welcome.classList.remove('hidden');
    } else {
        hideWelcome();
        conv.messages.forEach(m => appendMsg(m.role, m.text, true, m.imageUrl, m.time));
    }

    renderHistory();
    if (window.innerWidth < 768) closeSidebar();
}

/* ── Send ───────────────────────────────────────────────────── */
async function send() {
    const text = userInput.value.trim();
    if (!text || isTyping) {
        // Ensure button isn’t stuck disabled on empty input
        sendBtn.disabled = false;
        return;
    }

    if (!convStarted) {
        addHistoryItem(text);
        convStarted = true;
    }

    const conv = conversations.find(c => c.id === currentConvId);
    // Create history snapshot BEFORE appending current message
    const historySnapshot = conv ? [...conv.messages] : [];

    appendMsg('user', text);

    userInput.value = '';
    syncInput();
    isTyping = true;
    sendBtn.disabled = true;
    console.log('Send button disabled, initiating request');

    showTyping();

    let timeoutId = null;
    try {
        console.log('Sending request to backend with history:', historySnapshot);
        console.log(`[DIAGNOSTIC] Fetching URL: ${API_BASE}/chat`);

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            mode: 'cors',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                history: historySnapshot
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        clearTimeout(timeoutId);
        removeTyping();

        if (data.reply) {
            appendMsg('ai', data.reply);
        } else if (data.error) {
            appendMsg('ai', "Error: " + data.error);
        } else {
            appendMsg('ai', "I'm sorry, I couldn't get a response right now.");
        }

    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('Fetch error:', error);
        removeTyping();
        appendMsg('ai', "Connection error: " + error.message);
        showLumiAlert("Lumi is offline. Please check your terminal to ensure the backend is running.");
    } finally {
        isTyping = false;
        syncInput();
        // Re-enable send button after processing
        sendBtn.disabled = false;
        console.log('Chat response processed');
    }
}

/* ── Input sync ─────────────────────────────────────────────── */
function syncInput() {
    const len = userInput.value.length;
    const MAX = 4000;

    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';

    if (len > MAX * 0.8) {
        charHint.textContent = `${MAX - len} left`;
        charHint.className = 'char-hint' + (len > MAX * 0.95 ? ' error' : ' warn');
    } else {
        charHint.textContent = '';
        charHint.className = 'char-hint';
    }

    sendBtn.disabled = !userInput.value.trim() || isTyping;
}

/* ── Reset ──────────────────────────────────────────────────── */
function resetChat() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    messages.innerHTML = '';
    userInput.value = '';
    syncInput();
    welcome.classList.remove('hidden');
    topbarTitle.textContent = 'New conversation';
    convStarted = false;
    isTyping = false;
    currentConvId = null;

    renderHistory();
}

/* ── Sidebar mobile ─────────────────────────────────────────── */
function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
}
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

burger.addEventListener('click', () =>
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
);
overlay.addEventListener('click', closeSidebar);

/* ── Events ─────────────────────────────────────────────────── */
sendBtn.addEventListener('click', send);
micBtn.addEventListener('click', toggleMic);

userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

userInput.addEventListener('input', syncInput);
newChatBtn.addEventListener('click', resetChat);

const defaultDelBtn = document.getElementById('defaultDelBtn');
if (defaultDelBtn) {
    defaultDelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTargetId = 'default';
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.classList.add('show');
        }
    });
}

// Custom Delete Confirmation Modal Listeners
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteModal = document.getElementById('deleteModal');

if (cancelDeleteBtn && deleteModal) {
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('show');
        deleteTargetId = null;
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            deleteModal.classList.remove('show');
            deleteTargetId = null;
        }
    });
}

if (confirmDeleteBtn && deleteModal) {
    confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('show');
        if (deleteTargetId === 'default') {
            resetChat();
        } else if (deleteTargetId) {
            conversations = conversations.filter(c => c.id !== deleteTargetId);
            if (currentConvId === deleteTargetId) {
                resetChat();
            }
            renderHistory();
            saveToLocalStorage();
        }
        deleteTargetId = null;
    });
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        userInput.value = chip.dataset.text;
        syncInput();
        userInput.focus();
        setTimeout(send, 100);
    });
});

/* ── Init ───────────────────────────────────────────────────── */
renderHistory();
syncInput();
userInput.focus();

/* --- CUSTOM GLOBAL MODAL ALERT --- */
window.showLumiAlert = function(message) {
    const existing = document.getElementById('lumi-custom-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'lumi-custom-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: '9999', backdropFilter: 'blur(4px)', opacity: '0', transition: 'opacity 0.2s ease'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: 'var(--bg-card, #1E1E2E)', color: 'var(--text-color, #FFF)', padding: '24px',
        borderRadius: '16px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid var(--border-color, #333)', textAlign: 'center',
        transform: 'translateY(20px)', transition: 'transform 0.2s ease'
    });

    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0 0 20px 0'; text.style.fontSize = '1.1rem'; text.style.lineHeight = '1.5';

    const btn = document.createElement('button');
    btn.textContent = 'Got it';
    Object.assign(btn.style, {
        background: 'var(--primary-color, #6366F1)', color: '#FFF', border: 'none', padding: '10px 24px',
        borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'background 0.2s ease'
    });

    btn.onmouseover = () => btn.style.filter = 'brightness(1.2)';
    btn.onmouseout = () => btn.style.filter = 'none';

    btn.onclick = () => {
        modal.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        setTimeout(() => modal.remove(), 200);
    };

    box.appendChild(text);
    box.appendChild(btn);
    modal.appendChild(box);
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
};