# Widget.js 可設定化設計文件

**日期：** 2026-04-09
**目標：** 讓 widget.js 支援透過 `data-*` 屬性客製化外觀與行為，方便嵌入不同網站

---

## 背景

`backend/public/widget.js` 目前已實作完整的浮動聊天 widget（Web Component + Shadow DOM），但所有外觀與文字均為硬編碼。要讓外部網站嵌入時有彈性，需支援設定化。

嵌入方式（方案 A — data-* 屬性）：
```html
<script src="https://project1-production-76e0.up.railway.app/widget.js"
  data-color="#e91e63"
  data-title="ibon 客服"
  data-icon="🎫"
  data-welcome="您好！我是 ibon 票券客服，有什麼可以幫您？"
  data-open="false"
  data-position="right"
  data-lang="zh">
</script>
```

---

## Config 結構

所有屬性皆可選，未設定則使用預設值：

| 屬性 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `data-color` | string | `#2563eb` | 主題色（header、按鈕、用戶氣泡） |
| `data-title` | string | `智能客服` / `Support` | Widget 標頭標題 |
| `data-icon` | string | `💬` | 浮動按鈕 icon |
| `data-welcome` | string | 中/英預設問候語 | 開啟時第一句話 |
| `data-open` | `"true"/"false"` | `"false"` | 是否預設展開 |
| `data-position` | `"right"/"left"` | `"right"` | 浮動按鈕位置 |
| `data-lang` | `"zh"/"en"` | `"zh"` | 介面語言 |

---

## 實作架構

### 1. Config 讀取

使用 `document.currentScript` 在 IIFE 頂層讀取所有 `data-*` 屬性，產生 `cfg` 物件供後續使用：

```js
const cfg = (function() {
  const s = document.currentScript;
  const lang = s.dataset.lang || 'zh';
  return {
    color:    s.dataset.color    || '#2563eb',
    title:    s.dataset.title    || (lang === 'en' ? 'Support' : '智能客服'),
    icon:     s.dataset.icon     || '💬',
    welcome:  s.dataset.welcome  || (lang === 'en' ? 'Hi! How can I help you?' : '您好！我是智能客服，有什麼可以協助您的嗎？'),
    open:     s.dataset.open     === 'true',
    position: s.dataset.position || 'right',
    lang,
  };
})();
```

### 2. i18n 文字表

新增 `I18N` 物件，涵蓋所有固定 UI 文字：

```js
const I18N = {
  zh: {
    send: '送出',
    typing: '輸入中...',
    placeholder: '輸入您的問題...',
    contactPrompt: '請留下您的聯絡資訊，客服將盡快回覆您：',
    namePlaceholder: '姓名',
    emailPlaceholder: 'Email',
    messagePlaceholder: '問題描述',
    contactSubmit: '送出',
    contactHint: '需要人工客服協助嗎？',
    contactBtn: '聯絡客服',
    successMsg: '已收到您的留言！我們將盡快與您聯繫。感謝您的耐心等待。',
    errorMsg: '抱歉，連線發生錯誤，請稍後再試。',
    contactError: '送出失敗，請稍後再試或直接聯絡客服。',
    fillAll: '請填寫所有欄位',
    copy: '複製',
    copied: '已複製',
  },
  en: {
    send: 'Send',
    typing: 'Typing...',
    placeholder: 'Type a message...',
    contactPrompt: 'Please leave your contact info and we will get back to you:',
    namePlaceholder: 'Name',
    emailPlaceholder: 'Email',
    messagePlaceholder: 'Describe your issue',
    contactSubmit: 'Submit',
    contactHint: 'Need help from a human agent?',
    contactBtn: 'Contact Support',
    successMsg: 'Your message has been received! We will contact you shortly.',
    errorMsg: 'Connection error. Please try again later.',
    contactError: 'Submission failed. Please try again or contact support directly.',
    fillAll: 'Please fill in all fields.',
    copy: 'Copy',
    copied: 'Copied',
  },
};
```

### 3. CSS 動態主題色

CSS 中固定的 `#2563eb` / `#1d4ed8` 改為 CSS variable：

```css
:host {
  --widget-color: #2563eb;
  --widget-color-dark: #1d4ed8;
}
#toggle-btn { background: var(--widget-color); }
#chat-header { background: var(--widget-color); }
.bubble.user { background: var(--widget-color); }
/* 其餘同理 */
```

在 `render()` 中注入實際色值：

```js
this.shadow.host.style.setProperty('--widget-color', cfg.color);
this.shadow.host.style.setProperty('--widget-color-dark', darken(cfg.color));
```

`darken()` 為簡單輔助函式，將 hex 色值調深約 10%。

### 4. Position 控制

```css
#toggle-btn  { [position-side]: 24px; }
#chat-window { [position-side]: 24px; }
```

在 `render()` 中根據 `cfg.position` 動態設定 `left` 或 `right`。

### 5. 預設開啟

`connectedCallback()` 結尾加：

```js
if (cfg.open) this.toggleWindow();
```

---

## 檔案範圍

- **修改：** `backend/public/widget.js`（唯一改動檔案）
- **不動：** `backend/public/demo.html`、`backend/public/admin.html`、所有後端邏輯

---

## 向下相容

現有的 `<script src=".../widget.js"></script>`（無任何 data-* 屬性）行為完全不變，所有預設值與目前硬編碼一致。
