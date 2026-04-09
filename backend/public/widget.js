(function () {
  // Also duplicated in backend/tests/widget.test.js — keep both in sync.
  function darkenColor(hex, amount = 20) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex || '#2563eb';
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  const CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #toggle-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #toggle-btn:hover { background: #1d4ed8; }
    #chat-window {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 320px;
      height: 480px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
    }
    #chat-window.hidden { display: none; }
    #chat-header {
      background: #2563eb;
      color: white;
      padding: 14px 16px;
      font-weight: 600;
      font-size: 15px;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bubble {
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
    }
    .bubble.user {
      background: #2563eb;
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .bubble.assistant {
      background: #f3f4f6;
      color: #111;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .assistant-wrap {
      align-self: flex-start;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 80%;
    }
    .bubble-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .assistant-wrap:hover .bubble-actions { opacity: 1; }
    .copy-btn, .rate-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 5px;
      color: #9ca3af;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 3px;
      border-radius: 4px;
      transition: background 0.1s, color 0.1s;
    }
    .copy-btn:hover { color: #2563eb; }
    .copy-btn.copied { color: #16a34a; opacity: 1; }
    .rate-btn:hover { background: #e5e7eb; }
    .rate-btn.up.active { color: #16a34a; }
    .rate-btn.down.active { color: #ef4444; }
    .rate-divider { color: #d1d5db; font-size: 10px; }
    .typing { color: #9ca3af; font-style: italic; }
    .contact-hint {
      margin: 0 12px 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .contact-hint span { font-size: 12px; color: #1e40af; flex: 1; }
    .contact-hint button {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    .contact-hint button:hover { background: #1d4ed8; }
    #contact-form {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    #contact-form.hidden { display: none; }
    #contact-form p {
      margin: 0;
      font-size: 13px;
      color: #374151;
      font-weight: 600;
    }
    #contact-form input, #contact-form textarea {
      padding: 7px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      resize: none;
    }
    #contact-form textarea { height: 60px; }
    #contact-form button {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    #contact-form button:hover { background: #1d4ed8; }
    #input-area {
      display: flex;
      padding: 10px;
      border-top: 1px solid #e5e7eb;
      gap: 8px;
    }
    #input-area.hidden { display: none; }
    #user-input {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }
    #user-input:focus { border-color: #2563eb; }
    #send-btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 14px;
    }
    #send-btn:hover { background: #1d4ed8; }
    #send-btn:disabled { background: #93c5fd; cursor: not-allowed; }
  `;

  const API_BASE = (function () {
    const scripts = document.querySelectorAll('script[src]');
    const widgetScript = Array.from(scripts).find(s => s.src.includes('widget.js'));
    if (widgetScript) {
      const url = new URL(widgetScript.src);
      return url.origin;
    }
    return '';
  })();

  class ChatWidget extends HTMLElement {
    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      this.history = [];
      this.open = false;
    }

    connectedCallback() {
      this.render();
      this.bindEvents();
    }

    render() {
      this.shadow.innerHTML = `
        <style>${CSS}</style>
        <button id="toggle-btn" title="客服聊天">💬</button>
        <div id="chat-window" class="hidden">
          <div id="chat-header">智能客服</div>
          <div id="messages"></div>
          <div id="contact-form" class="hidden">
            <p>請留下您的聯絡資訊，客服將盡快回覆您：</p>
            <input type="text" id="cf-name" placeholder="姓名" />
            <input type="email" id="cf-email" placeholder="Email" />
            <textarea id="cf-message" placeholder="問題描述"></textarea>
            <button id="cf-submit">送出</button>
          </div>
          <div id="input-area">
            <input type="text" id="user-input" placeholder="輸入您的問題..." maxlength="500" />
            <button id="send-btn">送出</button>
          </div>
        </div>
      `;
    }

    bindEvents() {
      const s = this.shadow;
      s.getElementById('toggle-btn').addEventListener('click', () => this.toggleWindow());
      s.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
      s.getElementById('user-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
      });
      s.getElementById('cf-submit').addEventListener('click', () => this.submitContact());
    }

    toggleWindow() {
      this.open = !this.open;
      const win = this.shadow.getElementById('chat-window');
      win.classList.toggle('hidden', !this.open);
      if (this.open && this.history.length === 0) {
        this.addMessage('assistant', '您好！我是智能客服，有什麼可以協助您的嗎？');
      }
    }

    addMessage(role, text, convId = null) {
      const messages = this.shadow.getElementById('messages');
      if (role === 'assistant') {
        const wrap = document.createElement('div');
        wrap.className = 'assistant-wrap';
        const bubble = document.createElement('div');
        bubble.className = 'bubble assistant';
        bubble.textContent = text;

        const actions = document.createElement('div');
        actions.className = 'bubble-actions';

        // 複製按鈕
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 複製`;
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已複製`;
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 複製`;
            }, 2000);
          });
        });

        actions.appendChild(copyBtn);

        // 評分按鈕（只在有 convId 時加）
        if (convId) {
          const divider = document.createElement('span');
          divider.className = 'rate-divider';
          divider.textContent = '|';

          const upBtn = document.createElement('button');
          upBtn.className = 'rate-btn up';
          upBtn.title = '有幫助';
          upBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;

          const downBtn = document.createElement('button');
          downBtn.className = 'rate-btn down';
          downBtn.title = '沒有幫助';
          downBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;

          const sendRating = async (rating, activeBtn, otherBtn) => {
            try {
              await fetch(`${API_BASE}/api/chat/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: convId, rating })
              });
              activeBtn.classList.add('active');
              otherBtn.classList.remove('active');
            } catch {}
          };

          upBtn.addEventListener('click', () => sendRating(1, upBtn, downBtn));
          downBtn.addEventListener('click', () => sendRating(-1, downBtn, upBtn));

          actions.appendChild(divider);
          actions.appendChild(upBtn);
          actions.appendChild(downBtn);
        }

        wrap.appendChild(bubble);
        wrap.appendChild(actions);
        messages.appendChild(wrap);
      } else {
        const bubble = document.createElement('div');
        bubble.className = `bubble ${role}`;
        bubble.textContent = text;
        messages.appendChild(bubble);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    addTyping() {
      const messages = this.shadow.getElementById('messages');
      const el = document.createElement('div');
      el.className = 'bubble assistant typing';
      el.textContent = '輸入中...';
      el.id = 'typing-indicator';
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    }

    removeTyping() {
      const el = this.shadow.getElementById('typing-indicator');
      if (el) el.remove();
    }

    async sendMessage() {
      const input = this.shadow.getElementById('user-input');
      const sendBtn = this.shadow.getElementById('send-btn');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      sendBtn.disabled = true;
      this.addMessage('user', text);
      this.addTyping();

      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: this.history })
        });
        const data = await res.json();
        this.removeTyping();

        this.history.push({ role: 'user', content: text });
        this.history.push({ role: 'assistant', content: data.reply });
        this.addMessage('assistant', data.reply, data.id);

        if (data.needsHuman) {
          this.showContactHint();
        }
      } catch {
        this.removeTyping();
        this.addMessage('assistant', '抱歉，連線發生錯誤，請稍後再試。');
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }

    showContactHint() {
      const messages = this.shadow.getElementById('messages');
      // 避免重複出現
      if (this.shadow.querySelector('.contact-hint')) return;
      const hint = document.createElement('div');
      hint.className = 'contact-hint';
      hint.innerHTML = `<span>需要人工客服協助嗎？</span><button id="open-contact-btn">聯絡客服</button>`;
      hint.querySelector('#open-contact-btn').addEventListener('click', () => {
        hint.remove();
        this.showContactForm();
      });
      messages.appendChild(hint);
      messages.scrollTop = messages.scrollHeight;
    }

    showContactForm() {
      this.shadow.getElementById('input-area').classList.add('hidden');
      this.shadow.getElementById('contact-form').classList.remove('hidden');
    }

    async submitContact() {
      const name = this.shadow.getElementById('cf-name').value.trim();
      const email = this.shadow.getElementById('cf-email').value.trim();
      const message = this.shadow.getElementById('cf-message').value.trim();

      if (!name || !email || !message) {
        alert('請填寫所有欄位');
        return;
      }

      try {
        await fetch(`${API_BASE}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message, chatHistory: this.history })
        });
        this.shadow.getElementById('contact-form').classList.add('hidden');
        this.addMessage('assistant', '已收到您的留言！我們將盡快與您聯繫。感謝您的耐心等待。');
      } catch {
        this.addMessage('assistant', '送出失敗，請稍後再試或直接聯絡客服。');
      }
    }
  }

  customElements.define('chat-widget', ChatWidget);

  const widget = document.createElement('chat-widget');
  document.body.appendChild(widget);
})();
