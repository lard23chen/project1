# Widget.js 可設定化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `widget.js` 透過 `data-*` 屬性支援主題色、標題、icon、歡迎語、預設開啟、位置、語言等七項客製化設定。

**Architecture:** 在 IIFE 頂層讀取 `document.currentScript` 的 `data-*` 屬性產生 `cfg` 物件；新增 `I18N` 文字表支援中/英切換；CSS 改用 CSS variable 套用主題色；`render()` 與 `connectedCallback()` 使用 `cfg` 取代所有硬編碼值。所有改動集中在單一檔案，向下相容。

**Tech Stack:** Vanilla JS, Web Components (Custom Elements + Shadow DOM), CSS Variables, Jest (純函式單元測試)

---

## 檔案範圍

| 動作 | 路徑 | 說明 |
|------|------|------|
| 修改 | `backend/public/widget.js` | 加入 cfg、I18N、CSS variable、position、auto-open |
| 新增 | `backend/tests/widget.test.js` | 純函式（parseConfig、darkenColor）單元測試 |

---

### Task 1: 新增 darkenColor 純函式並通過測試

**Files:**
- Modify: `backend/public/widget.js`（頂層 IIFE 內，最前面）
- Create: `backend/tests/widget.test.js`

- [ ] **Step 1: 建立測試檔，寫入 darkenColor 的失敗測試**

建立 `backend/tests/widget.test.js`：

```js
// widget.js 是瀏覽器腳本，無法直接 require。
// 把純函式提取出來放在同一個測試用 module 裡驗證邏輯正確性。

function darkenColor(hex, amount = 20) {
  // placeholder — 測試應該 FAIL
}

describe('darkenColor', () => {
  test('將 #2563eb 調深應回傳較暗的 hex', () => {
    const result = darkenColor('#2563eb', 20);
    // R: 0x25=37 → 37-20=17 → 0x11
    // G: 0x63=99 → 99-20=79 → 0x4f
    // B: 0xeb=235 → 235-20=215 → 0xd7
    expect(result).toBe('#114fd7');
  });

  test('不會低於 0（clamp）', () => {
    const result = darkenColor('#050505', 20);
    expect(result).toBe('#000000');
  });

  test('不傳 amount 時預設調深 20', () => {
    const result = darkenColor('#2563eb');
    expect(result).toBe('#114fd7');
  });
});
```

- [ ] **Step 2: 執行測試，確認 FAIL**

```bash
cd backend && npx jest tests/widget.test.js --no-coverage
```

預期：FAIL（darkenColor 是 placeholder）

- [ ] **Step 3: 在 widget.test.js 實作 darkenColor 使測試通過**

將 `widget.test.js` 中的 placeholder 替換為實作：

```js
function darkenColor(hex, amount = 20) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: 執行測試，確認 PASS**

```bash
cd backend && npx jest tests/widget.test.js --no-coverage
```

預期：3 tests PASS

- [ ] **Step 5: 將 darkenColor 加入 widget.js 頂層 IIFE**

在 `backend/public/widget.js` 的 `(function () {` 後、`const CSS = ...` 前插入：

```js
  function darkenColor(hex, amount = 20) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
```

- [ ] **Step 6: Commit**

```bash
cd backend && git add public/widget.js tests/widget.test.js
git commit -m "feat: add darkenColor helper to widget.js with tests"
```

---

### Task 2: 新增 parseConfig 純函式並通過測試

**Files:**
- Modify: `backend/public/widget.js`
- Modify: `backend/tests/widget.test.js`

- [ ] **Step 1: 在 widget.test.js 新增 parseConfig 的失敗測試**

在 `widget.test.js` 尾端追加（parseConfig placeholder 放在 darkenColor 下方）：

```js
function parseConfig(dataset, defaults) {
  // placeholder — 測試應該 FAIL
}

const DEFAULTS = {
  color: '#2563eb',
  title: '智能客服',
  icon: '💬',
  welcome: '您好！我是智能客服，有什麼可以協助您的嗎？',
  open: false,
  position: 'right',
  lang: 'zh',
};

describe('parseConfig', () => {
  test('無任何 data-* 時全部使用預設值', () => {
    const cfg = parseConfig({}, DEFAULTS);
    expect(cfg).toEqual(DEFAULTS);
  });

  test('data-color 覆蓋預設色', () => {
    const cfg = parseConfig({ color: '#e91e63' }, DEFAULTS);
    expect(cfg.color).toBe('#e91e63');
  });

  test('data-open="true" 解析為 boolean true', () => {
    const cfg = parseConfig({ open: 'true' }, DEFAULTS);
    expect(cfg.open).toBe(true);
  });

  test('data-open="false" 解析為 boolean false', () => {
    const cfg = parseConfig({ open: 'false' }, DEFAULTS);
    expect(cfg.open).toBe(false);
  });

  test('data-lang="en" 時 title/welcome 使用英文預設', () => {
    const cfg = parseConfig({ lang: 'en' }, DEFAULTS);
    expect(cfg.title).toBe('Support');
    expect(cfg.lang).toBe('en');
  });

  test('data-lang="en" 但同時有 data-title 時優先用 data-title', () => {
    const cfg = parseConfig({ lang: 'en', title: 'ibon Help' }, DEFAULTS);
    expect(cfg.title).toBe('ibon Help');
  });
});
```

- [ ] **Step 2: 執行測試，確認 FAIL**

```bash
cd backend && npx jest tests/widget.test.js --no-coverage
```

預期：parseConfig 相關 6 tests FAIL

- [ ] **Step 3: 實作 parseConfig（在 widget.test.js 中）**

將 `parseConfig` placeholder 替換為：

```js
function parseConfig(dataset, defaults) {
  const lang = dataset.lang || defaults.lang;
  const enDefaults = { title: 'Support', welcome: 'Hi! How can I help you?' };
  return {
    color:    dataset.color    || defaults.color,
    title:    dataset.title    || (lang === 'en' ? enDefaults.title : defaults.title),
    icon:     dataset.icon     || defaults.icon,
    welcome:  dataset.welcome  || (lang === 'en' ? enDefaults.welcome : defaults.welcome),
    open:     dataset.open === 'true',
    position: dataset.position || defaults.position,
    lang,
  };
}
```

- [ ] **Step 4: 執行測試，確認全部 PASS**

```bash
cd backend && npx jest tests/widget.test.js --no-coverage
```

預期：9 tests PASS（3 darkenColor + 6 parseConfig）

- [ ] **Step 5: 將 parseConfig 與 DEFAULTS 加入 widget.js**

在 `widget.js` 的 `darkenColor` 函式後插入：

```js
  const DEFAULTS = {
    color:    '#2563eb',
    title:    '智能客服',
    icon:     '💬',
    welcome:  '您好！我是智能客服，有什麼可以協助您的嗎？',
    open:     false,
    position: 'right',
    lang:     'zh',
  };

  function parseConfig(dataset, defaults) {
    const lang = dataset.lang || defaults.lang;
    const enDefaults = { title: 'Support', welcome: 'Hi! How can I help you?' };
    return {
      color:    dataset.color    || defaults.color,
      title:    dataset.title    || (lang === 'en' ? enDefaults.title : defaults.title),
      icon:     dataset.icon     || defaults.icon,
      welcome:  dataset.welcome  || (lang === 'en' ? enDefaults.welcome : defaults.welcome),
      open:     dataset.open === 'true',
      position: dataset.position || defaults.position,
      lang,
    };
  }
```

- [ ] **Step 6: 在 widget.js 中讀取 cfg（取代 API_BASE 後面）**

在 `API_BASE` 常數區塊後、`class ChatWidget` 前插入：

```js
  const cfg = parseConfig(
    (document.currentScript || {}).dataset || {},
    DEFAULTS
  );
```

- [ ] **Step 7: Commit**

```bash
cd backend && git add public/widget.js tests/widget.test.js
git commit -m "feat: add parseConfig with cfg object to widget.js"
```

---

### Task 3: 新增 I18N 文字表並套用至 render()

**Files:**
- Modify: `backend/public/widget.js`

- [ ] **Step 1: 在 widget.js 的 cfg 後插入 I18N 物件**

```js
  const I18N = {
    zh: {
      send:            '送出',
      typing:          '輸入中...',
      placeholder:     '輸入您的問題...',
      contactPrompt:   '請留下您的聯絡資訊，客服將盡快回覆您：',
      namePlaceholder: '姓名',
      emailPlaceholder:'Email',
      msgPlaceholder:  '問題描述',
      contactSubmit:   '送出',
      contactHint:     '需要人工客服協助嗎？',
      contactBtn:      '聯絡客服',
      successMsg:      '已收到您的留言！我們將盡快與您聯繫。感謝您的耐心等待。',
      errorMsg:        '抱歉，連線發生錯誤，請稍後再試。',
      contactError:    '送出失敗，請稍後再試或直接聯絡客服。',
      fillAll:         '請填寫所有欄位',
      copy:            '複製',
      copied:          '已複製',
    },
    en: {
      send:            'Send',
      typing:          'Typing...',
      placeholder:     'Type a message...',
      contactPrompt:   'Please leave your contact info and we will get back to you:',
      namePlaceholder: 'Name',
      emailPlaceholder:'Email',
      msgPlaceholder:  'Describe your issue',
      contactSubmit:   'Submit',
      contactHint:     'Need help from a human agent?',
      contactBtn:      'Contact Support',
      successMsg:      'Your message has been received! We will contact you shortly.',
      errorMsg:        'Connection error. Please try again later.',
      contactError:    'Submission failed. Please try again or contact support directly.',
      fillAll:         'Please fill in all fields.',
      copy:            'Copy',
      copied:          'Copied',
    },
  };

  const t = I18N[cfg.lang] || I18N.zh;
```

- [ ] **Step 2: 將 render() 的 HTML 改用 cfg 與 t**

找到 `render()` 方法，將其完整替換為：

```js
    render() {
      this.shadow.innerHTML = `
        <style>${CSS}</style>
        <button id="toggle-btn" title="${t.send}">${cfg.icon}</button>
        <div id="chat-window" class="hidden">
          <div id="chat-header">${cfg.title}</div>
          <div id="messages"></div>
          <div id="contact-form" class="hidden">
            <p>${t.contactPrompt}</p>
            <input type="text" id="cf-name" placeholder="${t.namePlaceholder}" />
            <input type="email" id="cf-email" placeholder="${t.emailPlaceholder}" />
            <textarea id="cf-message" placeholder="${t.msgPlaceholder}"></textarea>
            <button id="cf-submit">${t.contactSubmit}</button>
          </div>
          <div id="input-area">
            <input type="text" id="user-input" placeholder="${t.placeholder}" maxlength="500" />
            <button id="send-btn">${t.send}</button>
          </div>
        </div>
      `;
    }
```

- [ ] **Step 3: 更新所有硬編碼的 UI 文字為 t.xxx**

在 `addTyping()`，將 `'輸入中...'` 改為 `t.typing`：
```js
      el.textContent = t.typing;
```

在 `addMessage()` 的 copyBtn 部分，將 `'複製'`/`'已複製'` 改為 `t.copy`/`t.copied`：
```js
      copyBtn.innerHTML = `<svg ...></svg> ${t.copy}`;
      // setTimeout 內：
      copyBtn.innerHTML = `<svg ...></svg> ${t.copied}`;
```

在 `showContactHint()`，將 `'需要人工客服協助嗎？'`/`'聯絡客服'` 改為 `t.contactHint`/`t.contactBtn`：
```js
      hint.innerHTML = `<span>${t.contactHint}</span><button id="open-contact-btn">${t.contactBtn}</button>`;
```

在 `sendMessage()` 的 catch 區塊，改為 `t.errorMsg`：
```js
        this.addMessage('assistant', t.errorMsg);
```

在 `submitContact()` 中：
- `alert('請填寫所有欄位')` → `alert(t.fillAll)`
- 成功訊息 `'已收到您的留言！...'` → `t.successMsg`
- 失敗訊息 `'送出失敗，...'` → `t.contactError`

在 `toggleWindow()` 的歡迎語，改為 `cfg.welcome`：
```js
        this.addMessage('assistant', cfg.welcome);
```

- [ ] **Step 4: 手動驗證（瀏覽器）**

在 `frontend/demo.html` 暫時改 script 標籤測試中文預設：
```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"></script>
```
確認：標題「智能客服」、送出按鈕文字、歡迎語均正常。

- [ ] **Step 5: Commit**

```bash
cd backend && git add public/widget.js
git commit -m "feat: add I18N support and apply t.xxx to all widget UI text"
```

---

### Task 4: CSS variable 主題色 + position 支援

**Files:**
- Modify: `backend/public/widget.js`

- [ ] **Step 1: 將 CSS 中所有主題色改為 variable**

找到 `const CSS = \`...\`` 區塊，將所有 `#2563eb` 和 `#1d4ed8` 改為 variable：

```css
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --wc: #2563eb;
      --wc-dark: #1d4ed8;
    }
```

然後全文替換：
- `background: #2563eb` → `background: var(--wc)`
- `background: #1d4ed8` → `background: var(--wc-dark)`
- `border-color: #2563eb` → `border-color: var(--wc)`（user-input focus）
- `color: #2563eb` → `color: var(--wc)`（copy-btn hover）
- `background: #93c5fd` → 保留不動（disabled 狀態用淡色，與主色無強關聯）

完整替換清單（全部在 CSS template literal 內）：

| 原始值 | 替換為 |
|--------|--------|
| `background: #2563eb` | `background: var(--wc)` |
| `background: #1d4ed8` | `background: var(--wc-dark)` |
| `border-color: #2563eb` | `border-color: var(--wc)` |
| `color: #2563eb` | `color: var(--wc)` |

- [ ] **Step 2: 將 position 加入 CSS 為動態佔位符**

在 CSS 中，將 `#toggle-btn` 和 `#chat-window` 的固定 `right: 24px` 改為佔位符，稍後由 JS 注入：

```css
    #toggle-btn {
      position: fixed;
      bottom: 24px;
      /* position 由 JS 注入 */
      width: 56px;
      height: 56px;
      /* ... 其餘不變 ... */
    }
    #chat-window {
      position: fixed;
      bottom: 92px;
      /* position 由 JS 注入 */
      /* ... 其餘不變 ... */
    }
```

移除 `right: 24px` 這兩行（共 2 處）。

- [ ] **Step 3: 在 connectedCallback() 套用 cfg 的色值與 position**

找到 `connectedCallback()` 方法，在 `this.render()` 和 `this.bindEvents()` 呼叫之後加入：

```js
    connectedCallback() {
      this.render();
      this.bindEvents();
      // 套用主題色
      this.shadow.host.style.setProperty('--wc', cfg.color);
      this.shadow.host.style.setProperty('--wc-dark', darkenColor(cfg.color));
      // 套用 position
      const side = cfg.position === 'left' ? 'left' : 'right';
      const opp  = side === 'left' ? 'right' : 'left';
      const btn  = this.shadow.getElementById('toggle-btn');
      const win  = this.shadow.getElementById('chat-window');
      btn.style[side] = '24px';
      btn.style[opp]  = '';
      win.style[side] = '24px';
      win.style[opp]  = '';
      // 預設開啟
      if (cfg.open) this.toggleWindow();
    }
```

- [ ] **Step 4: 手動驗證主題色（瀏覽器）**

修改 `frontend/demo.html`，在 script 標籤加上 data-color：
```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-color="#e91e63"
  data-title="ibon 客服"
  data-icon="🎫">
</script>
```

在本地用 `node backend/server.js` 啟動，開啟 `http://localhost:3000/demo.html`。

確認：
- 浮動按鈕、header、用戶氣泡均呈粉紅色
- 標題顯示「ibon 客服」
- 按鈕 icon 為 🎫

還原 demo.html 為原始 script 標籤（無 data-* 屬性）後確認預設藍色正常。

- [ ] **Step 5: 手動驗證 position left**

```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-position="left">
</script>
```

確認按鈕出現在左下角，視窗也靠左展開。

- [ ] **Step 6: 手動驗證 data-open="true"**

```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-open="true">
</script>
```

確認頁面載入後聊天視窗自動展開，顯示歡迎語。

- [ ] **Step 7: 執行所有測試確認無迴歸**

```bash
cd backend && npx jest --no-coverage
```

預期：全部 PASS（widget.test.js 9 tests + 其他原有 tests）

- [ ] **Step 8: Commit**

```bash
cd backend && git add public/widget.js
git commit -m "feat: apply CSS variables for theme color and dynamic position to widget"
```

---

### Task 5: 英文介面端對端驗證 + 最終整合

**Files:**
- Modify: `backend/public/widget.js`（若有小修正）

- [ ] **Step 1: 驗證英文模式**

修改 `frontend/demo.html`（暫時）：
```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-lang="en"
  data-color="#4CAF50">
</script>
```

啟動本地 server，確認：
- 按鈕送出文字為「Send」
- placeholder 為「Type a message...」
- 歡迎語為「Hi! How can I help you?」
- 輸入中提示為「Typing...」

- [ ] **Step 2: 驗證向下相容（無任何 data-*）**

還原 `frontend/demo.html` 為：
```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"></script>
```

確認所有功能、外觀與修改前完全一致（藍色主題、中文介面、右下角）。

- [ ] **Step 3: 執行全部測試**

```bash
cd backend && npx jest --no-coverage
```

預期：全部 PASS

- [ ] **Step 4: 最終 commit**

```bash
cd backend && git add public/widget.js
git commit -m "feat: widget.js configurable via data-* attributes (color, title, icon, welcome, open, position, lang)"
```

- [ ] **Step 5: 更新 ibon_QA_Report_Catalog.html 示範嵌入碼**

在 `ibon_QA_Report_Catalog.html` 的 `</body>` 前加入說明區塊：

```html
<div style="background:#1e1e1e; border-radius:12px; padding:24px; margin-top:20px; font-family:monospace; font-size:13px; color:#e0e0e0;">
  <p style="color:#42f5b6; font-weight:bold; margin:0 0 12px;">🔌 嵌入此客服 Widget</p>
  <p style="color:#a0a0a0; margin:0 0 8px;">在任何網頁的 &lt;/body&gt; 前貼上此行即可：</p>
  <pre style="background:#000; padding:12px; border-radius:8px; overflow-x:auto; color:#ff9800;">&lt;script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-color="#2563eb"
  data-title="ibon 客服"
  data-icon="🎫"
  data-lang="zh"&gt;&lt;/script&gt;</pre>
</div>
```

然後推送至 GitHub Pages（與之前相同的 `gh api PUT` 方式）。
