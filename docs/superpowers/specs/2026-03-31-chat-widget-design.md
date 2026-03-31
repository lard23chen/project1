# 智能客服 Chat Widget 設計文件

**日期：** 2026-03-31  
**狀態：** 已確認，待實作

---

## 概述

在現有靜態 HTML 網站上嵌入一個懸浮式智能客服對話元件。使用者可直接在網頁中開啟聊天視窗與 AI 對話；若 AI 無法回答，自動引導至人工客服留言表單，並透過 Webhook 通知客服人員。

---

## 架構

```
使用者網頁 (HTML)
   └── <script> 引入 widget.js
         └── 懸浮聊天按鈕 + 對話視窗 (純 Vanilla JS + Shadow DOM)
               │
               │ HTTP POST /api/chat
               │ HTTP POST /api/contact
               ▼
         Node.js Express 後端
               ├── RAG 模組：關鍵字搜尋本地知識庫 (JSON)
               ├── Claude API：組合 prompt + 呼叫 claude-sonnet-4-6
               ├── 轉人工判斷：AI 回覆帶 needsHuman 標記
               └── /api/contact：收表單 → 發 Webhook
```

---

## 前端 Widget

### 外觀與行為

- 右下角固定懸浮圓形按鈕（聊天圖示）
- 點擊展開聊天視窗（320×480px），再點縮回
- 視窗元件：標題列、對話訊息區（捲動）、輸入框、送出按鈕
- AI 回覆中顯示「輸入中...」三點動畫

### 對話流程

```
用戶輸入問題
   ↓
顯示 loading 動畫
   ↓
後端回傳 AI 回覆 → 顯示氣泡
   ↓
若 needsHuman: true → 自動切換顯示人工客服表單
   (欄位：姓名 / Email / 問題描述)
   ↓
表單送出成功 → 顯示確認訊息「我們將盡快與您聯繫」
```

### 技術規格

- 純 Vanilla JS + CSS，不依賴任何第三方前端套件
- 樣式封裝於 Shadow DOM，不影響宿主網頁既有樣式
- 嵌入方式：
  ```html
  <script src="https://your-server.com/widget.js"></script>
  ```

---

## 後端 API

### 端點列表

| 端點 | 方法 | 說明 |
|------|------|------|
| `GET /widget.js` | GET | 提供前端 widget 腳本 |
| `POST /api/chat` | POST | 接收用戶訊息，回傳 AI 回覆 |
| `POST /api/contact` | POST | 接收人工客服表單，送出 Webhook |

### `/api/chat` 請求 / 回應

**請求：**
```json
{
  "message": "如何申請退款？",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**回應（正常）：**
```json
{
  "reply": "請在購買後 7 天內...",
  "needsHuman": false
}
```

**回應（轉人工）：**
```json
{
  "reply": "很抱歉，這個問題需要由客服人員為您處理。",
  "needsHuman": true
}
```

### `/api/contact` 請求

```json
{
  "name": "王小明",
  "email": "user@example.com",
  "message": "我想詢問關於...",
  "chatHistory": [...],
  "timestamp": "2026-03-31T12:00:00Z"
}
```

送出後轉發至 `.env` 中設定的 `WEBHOOK_URL`。

---

## RAG 知識庫

### 搜尋流程

```
收到用戶問題
   ↓
對問題做關鍵字斷詞
   ↓
比對知識庫各筆資料的 tags + question 欄位
   ↓
取出相似度最高的 3-5 筆
   ↓
組合成 Claude prompt context
```

### 知識庫格式（`/data/knowledge.json`）

```json
[
  {
    "id": "1",
    "tags": ["退款", "訂單", "取消"],
    "question": "如何申請退款？",
    "answer": "請在購買後 7 天內透過會員中心提交退款申請..."
  }
]
```

- 支援多個 JSON 檔案分類（FAQ、政策、產品），後端啟動時全部載入記憶體
- 後續可升級為向量搜尋（語意相似度）

### Claude Prompt 結構

```
[系統指令]
你是一位專業客服助理，只能根據以下知識庫資料回答問題。
請以 JSON 格式回覆：
{
  "reply": "回答內容",
  "needsHuman": false
}
若問題超出知識庫範圍，或無法給出確定答案，則：
{
  "reply": "很抱歉，這個問題需要由客服人員為您處理。",
  "needsHuman": true
}

[知識庫內容]
...相關段落（最多 5 筆）...

[對話歷史]
...最近 6 則訊息...

[用戶問題]
...
```

---

## Webhook 通知

- 格式：HTTP POST，Content-Type: application/json
- 支援目標：Slack Incoming Webhook、Line Notify、自訂後端 URL
- 設定位置：後端 `.env` 的 `WEBHOOK_URL`

---

## 安全性

| 項目 | 做法 |
|------|------|
| Claude API Key | 存於後端 `.env`，前端不可見 |
| CORS 保護 | 只允許白名單網域（`.env` 設定）呼叫 API |
| Rate Limiting | 每個 IP 每分鐘最多 10 次請求 |
| 輸入過濾 | 訊息長度上限 500 字，防止 prompt injection |

---

## 專案目錄結構

```
project1/
├── backend/
│   ├── server.js              # Express 主程式、中介軟體設定
│   ├── routes/
│   │   ├── chat.js            # POST /api/chat
│   │   └── contact.js         # POST /api/contact
│   ├── services/
│   │   ├── rag.js             # 知識庫載入與關鍵字搜尋
│   │   └── claude.js          # Claude API 呼叫封裝
│   ├── data/
│   │   └── knowledge.json     # 知識庫資料（可多檔）
│   ├── package.json
│   └── .env                   # CLAUDE_API_KEY, WEBHOOK_URL, ALLOWED_ORIGIN
└── frontend/
    ├── widget.js              # 嵌入式聊天 UI（含打包 CSS）
    └── demo.html              # 本機測試用示範頁面
```

---

## 技術堆疊

| 層 | 技術 |
|----|------|
| 前端 | Vanilla JS、Shadow DOM、CSS |
| 後端 | Node.js、Express |
| AI | Claude API (`claude-sonnet-4-6`) |
| RAG | 關鍵字搜尋（In-memory JSON） |
| 通知 | HTTP Webhook（POST JSON） |
| 部署 | 任意 Node.js 伺服器 |
