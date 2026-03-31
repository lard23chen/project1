# 智能客服 Chat Widget 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個嵌入式智能客服 Widget，使用 Claude API + RAG 知識庫自動回答，無法回答時引導至人工客服表單並透過 Webhook 通知。

**Architecture:** Node.js Express 後端處理 Claude API 呼叫與 RAG 搜尋，前端為純 Vanilla JS + Shadow DOM 的懸浮式聊天元件，透過 `<script>` 標籤嵌入任何靜態 HTML 頁面。

**Tech Stack:** Node.js, Express, @anthropic-ai/sdk, cors, express-rate-limit, dotenv, Jest, Supertest

---

## 檔案結構

```
project1/
├── backend/
│   ├── server.js                  # Express 主程式、中介軟體、路由掛載
│   ├── routes/
│   │   ├── chat.js                # POST /api/chat
│   │   └── contact.js             # POST /api/contact
│   ├── services/
│   │   ├── rag.js                 # 知識庫載入 + 關鍵字搜尋
│   │   └── claude.js              # Claude API 呼叫封裝
│   ├── data/
│   │   └── knowledge.json         # 範例知識庫資料
│   ├── tests/
│   │   ├── rag.test.js
│   │   ├── claude.test.js
│   │   ├── chat.test.js
│   │   └── contact.test.js
│   ├── package.json
│   ├── .env.example
│   └── .env                       # 不進 git
└── frontend/
    ├── widget.js                  # 嵌入式聊天 UI（含內嵌 CSS）
    └── demo.html                  # 本機測試用示範頁面
```

---

## Task 1: 後端專案初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/.env`
- Create: `backend/server.js`

- [ ] **Step 1: 建立 backend 目錄結構**

```bash
cd D:/2026/Claude/project1
mkdir -p backend/routes backend/services backend/data backend/tests frontend
```

- [ ] **Step 2: 初始化 package.json**

```bash
cd D:/2026/Claude/project1/backend
npm init -y
```

- [ ] **Step 3: 安裝相依套件**

```bash
npm install express cors express-rate-limit dotenv @anthropic-ai/sdk
npm install --save-dev jest supertest
```

- [ ] **Step 4: 更新 package.json 加入 test script**

編輯 `backend/package.json`，加入：
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest --testEnvironment=node"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 5: 建立 .env.example**

建立 `backend/.env.example`：
```
CLAUDE_API_KEY=your_claude_api_key_here
WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALLOWED_ORIGIN=http://localhost:3000
PORT=3001
```

- [ ] **Step 6: 建立 .env（本機用）**

建立 `backend/.env`（填入真實值）：
```
CLAUDE_API_KEY=your_actual_api_key
WEBHOOK_URL=https://your-webhook-url
ALLOWED_ORIGIN=*
PORT=3001
```

- [ ] **Step 7: 建立基礎 server.js**

建立 `backend/server.js`：
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));

app.use(express.json({ limit: '10kb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '請求過於頻繁，請稍後再試' }
}));

app.use('/api/chat', require('./routes/chat'));
app.use('/api/contact', require('./routes/contact'));

app.use(express.static('../frontend'));

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 8: 確認 server.js 語法正確**

```bash
cd D:/2026/Claude/project1/backend
node -e "require('./server.js'); console.log('OK')"
```

Expected: `Server running on port 3001` 或 `OK`（無 error）

- [ ] **Step 9: 建立 .gitignore**

建立 `backend/.gitignore`：
```
node_modules/
.env
```

- [ ] **Step 10: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/package.json backend/.env.example backend/server.js backend/.gitignore
git commit -m "feat: initialize backend project structure"
```

---

## Task 2: RAG 知識庫服務

**Files:**
- Create: `backend/services/rag.js`
- Create: `backend/data/knowledge.json`
- Create: `backend/tests/rag.test.js`

- [ ] **Step 1: 建立範例知識庫資料**

建立 `backend/data/knowledge.json`：
```json
[
  {
    "id": "1",
    "tags": ["退款", "訂單", "取消", "七天"],
    "question": "如何申請退款？",
    "answer": "請在購買後 7 天內登入會員中心，至「我的訂單」點選「申請退款」，填寫退款原因後送出。退款將於 3-5 個工作天內退回原付款方式。"
  },
  {
    "id": "2",
    "tags": ["配送", "運費", "到貨", "快遞"],
    "question": "配送需要多少時間？",
    "answer": "一般訂單在確認付款後 1-2 個工作天出貨，台灣本島配送約 2-3 個工作天到貨。離島地區約需 5-7 個工作天。"
  },
  {
    "id": "3",
    "tags": ["付款", "信用卡", "ATM", "超商"],
    "question": "支援哪些付款方式？",
    "answer": "我們支援以下付款方式：信用卡（Visa/MasterCard/JCB）、ATM 轉帳、超商代碼繳費（7-11、全家、萊爾富）、Line Pay。"
  },
  {
    "id": "4",
    "tags": ["帳號", "密碼", "登入", "忘記"],
    "question": "忘記密碼怎麼辦？",
    "answer": "請至登入頁面點選「忘記密碼」，輸入您的註冊 Email，系統將發送重設密碼連結至您的信箱（有效期限 30 分鐘）。"
  },
  {
    "id": "5",
    "tags": ["發票", "電子發票", "統一編號", "捐贈"],
    "question": "如何取得發票？",
    "answer": "本店使用電子發票，訂單完成後自動開立。您可在會員中心查看發票號碼，也可在下單時填入統一編號開立公司戶發票，或選擇捐贈發票。"
  }
]
```

- [ ] **Step 2: 撰寫 rag.test.js**

建立 `backend/tests/rag.test.js`：
```javascript
const path = require('path');
const { loadKnowledge, search } = require('../services/rag');

describe('RAG Service', () => {
  let knowledge;

  beforeAll(() => {
    knowledge = loadKnowledge(path.join(__dirname, '../data'));
  });

  test('loadKnowledge 載入後應有資料', () => {
    expect(Array.isArray(knowledge)).toBe(true);
    expect(knowledge.length).toBeGreaterThan(0);
  });

  test('每筆資料應有 id, tags, question, answer 欄位', () => {
    knowledge.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('tags');
      expect(item).toHaveProperty('question');
      expect(item).toHaveProperty('answer');
    });
  });

  test('search("退款") 應回傳包含退款相關項目', () => {
    const results = search(knowledge, '我想申請退款');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
  });

  test('search("配送") 應回傳配送相關項目', () => {
    const results = search(knowledge, '配送需要幾天');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('2');
  });

  test('search 回傳筆數最多 5 筆', () => {
    const results = search(knowledge, '訂單付款配送退款帳號發票');
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test('search 完全不相關的問題應回傳空陣列或低分', () => {
    const results = search(knowledge, 'zzzzxxxxxqqqqq');
    expect(results.length).toBe(0);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/rag.test.js --verbose
```

Expected: FAIL（`Cannot find module '../services/rag'`）

- [ ] **Step 4: 實作 rag.js**

建立 `backend/services/rag.js`：
```javascript
const fs = require('fs');
const path = require('path');

function loadKnowledge(dataDir) {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
    items.push(...content);
  }
  return items;
}

function tokenize(text) {
  // 中文字每個字視為一個 token，英文以空白分詞
  return text
    .toLowerCase()
    .split('')
    .filter(c => /[\u4e00-\u9fff\w]/.test(c));
}

function score(item, queryTokens) {
  const searchable = [
    ...item.tags,
    ...item.question.split('')
  ].map(t => t.toLowerCase());

  let hits = 0;
  for (const token of queryTokens) {
    if (searchable.some(s => s.includes(token) || token.includes(s))) {
      hits++;
    }
  }
  return hits;
}

function search(knowledge, query, topN = 5) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = knowledge
    .map(item => ({ item, score: score(item, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ item }) => item);

  return scored;
}

module.exports = { loadKnowledge, search };
```

- [ ] **Step 5: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/rag.test.js --verbose
```

Expected: 所有 6 個測試 PASS

- [ ] **Step 6: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/services/rag.js backend/data/knowledge.json backend/tests/rag.test.js
git commit -m "feat: add RAG knowledge base service with keyword search"
```

---

## Task 3: Claude API 服務

**Files:**
- Create: `backend/services/claude.js`
- Create: `backend/tests/claude.test.js`

- [ ] **Step 1: 撰寫 claude.test.js（使用 mock）**

建立 `backend/tests/claude.test.js`：
```javascript
jest.mock('@anthropic-ai/sdk', () => {
  return class Anthropic {
    constructor() {
      this.messages = {
        create: jest.fn()
      };
    }
  };
});

const Anthropic = require('@anthropic-ai/sdk');
const { askClaude } = require('../services/claude');

describe('Claude Service', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new Anthropic();
    jest.clearAllMocks();
  });

  test('正常回答：回傳 reply 和 needsHuman: false', async () => {
    mockClient.messages.create.mockResolvedValueOnce({
      content: [{ text: '{"reply":"請在7天內申請退款","needsHuman":false}' }]
    });

    const result = await askClaude(
      mockClient,
      [{ id: '1', question: '退款', answer: '7天內申請' }],
      [],
      '如何退款？'
    );

    expect(result.reply).toBe('請在7天內申請退款');
    expect(result.needsHuman).toBe(false);
  });

  test('無法回答：回傳 needsHuman: true', async () => {
    mockClient.messages.create.mockResolvedValueOnce({
      content: [{ text: '{"reply":"很抱歉，需要客服人員協助","needsHuman":true}' }]
    });

    const result = await askClaude(mockClient, [], [], '你是誰？');

    expect(result.needsHuman).toBe(true);
  });

  test('Claude 回傳非 JSON 時，應使用 fallback', async () => {
    mockClient.messages.create.mockResolvedValueOnce({
      content: [{ text: '這是一段普通文字，不是 JSON' }]
    });

    const result = await askClaude(mockClient, [], [], '測試');

    expect(result).toHaveProperty('reply');
    expect(result).toHaveProperty('needsHuman');
    expect(result.needsHuman).toBe(true);
  });

  test('Claude API 拋出錯誤時，應回傳 needsHuman: true', async () => {
    mockClient.messages.create.mockRejectedValueOnce(new Error('API error'));

    const result = await askClaude(mockClient, [], [], '測試');

    expect(result.needsHuman).toBe(true);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/claude.test.js --verbose
```

Expected: FAIL（`Cannot find module '../services/claude'`）

- [ ] **Step 3: 實作 claude.js**

建立 `backend/services/claude.js`：
```javascript
const SYSTEM_PROMPT = `你是一位專業客服助理，只能根據以下知識庫資料回答問題。
請務必以 JSON 格式回覆，格式如下：
{"reply": "回答內容", "needsHuman": false}
若問題超出知識庫範圍，或無法給出確定答案，請回覆：
{"reply": "很抱歉，這個問題需要由客服人員為您處理。", "needsHuman": true}
請只回覆 JSON，不要包含任何其他文字。`;

function buildContext(knowledgeItems) {
  if (knowledgeItems.length === 0) return '（無相關知識庫資料）';
  return knowledgeItems
    .map(item => `Q: ${item.question}\nA: ${item.answer}`)
    .join('\n\n');
}

function buildMessages(knowledgeItems, history, userMessage) {
  const context = buildContext(knowledgeItems);
  const systemWithContext = `${SYSTEM_PROMPT}\n\n[知識庫內容]\n${context}`;

  const recentHistory = history.slice(-6);

  return {
    system: systemWithContext,
    messages: [
      ...recentHistory,
      { role: 'user', content: userMessage }
    ]
  };
}

async function askClaude(client, knowledgeItems, history, userMessage) {
  try {
    const { system, messages } = buildMessages(knowledgeItems, history, userMessage);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages
    });

    const text = response.content[0].text.trim();

    // 嘗試解析 JSON（有時 Claude 可能加上 ```json 包裹）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.reply !== 'string' || typeof parsed.needsHuman !== 'boolean') {
      throw new Error('Invalid response shape');
    }

    return parsed;
  } catch {
    return {
      reply: '很抱歉，系統暫時無法回答，請稍後再試或聯繫客服。',
      needsHuman: true
    };
  }
}

module.exports = { askClaude };
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/claude.test.js --verbose
```

Expected: 所有 4 個測試 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/services/claude.js backend/tests/claude.test.js
git commit -m "feat: add Claude API service with JSON response parsing"
```

---

## Task 4: Chat 路由

**Files:**
- Create: `backend/routes/chat.js`
- Create: `backend/tests/chat.test.js`

- [ ] **Step 1: 撰寫 chat.test.js**

建立 `backend/tests/chat.test.js`：
```javascript
const request = require('supertest');

// Mock Claude service
jest.mock('../services/claude', () => ({
  askClaude: jest.fn()
}));

const { askClaude } = require('../services/claude');
const app = require('../server');

describe('POST /api/chat', () => {
  test('缺少 message 應回傳 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('message 超過 500 字應回傳 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/500/);
  });

  test('正常請求應回傳 reply 和 needsHuman', async () => {
    askClaude.mockResolvedValueOnce({ reply: '退款請至會員中心', needsHuman: false });

    const res = await request(app)
      .post('/api/chat')
      .send({ message: '如何退款？', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('退款請至會員中心');
    expect(res.body.needsHuman).toBe(false);
  });

  test('needsHuman: true 時，回應中 needsHuman 為 true', async () => {
    askClaude.mockResolvedValueOnce({ reply: '需要客服協助', needsHuman: true });

    const res = await request(app)
      .post('/api/chat')
      .send({ message: '我有特殊問題' });

    expect(res.status).toBe(200);
    expect(res.body.needsHuman).toBe(true);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/chat.test.js --verbose
```

Expected: FAIL（`Cannot find module '../routes/chat'`）

- [ ] **Step 3: 實作 chat.js**

建立 `backend/routes/chat.js`：
```javascript
const express = require('express');
const path = require('path');
const router = express.Router();
const { loadKnowledge, search } = require('../services/rag');
const { askClaude } = require('../services/claude');
const Anthropic = require('@anthropic-ai/sdk');

const knowledge = loadKnowledge(path.join(__dirname, '../data'));
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '請提供 message 欄位' });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: '訊息長度不能超過 500 字' });
  }

  const relevant = search(knowledge, message);
  const result = await askClaude(client, relevant, history, message);

  res.json(result);
});

module.exports = router;
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/chat.test.js --verbose
```

Expected: 所有 4 個測試 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/routes/chat.js backend/tests/chat.test.js
git commit -m "feat: add /api/chat route with input validation and RAG"
```

---

## Task 5: Contact 路由 + Webhook

**Files:**
- Create: `backend/routes/contact.js`
- Create: `backend/tests/contact.test.js`

- [ ] **Step 1: 撰寫 contact.test.js**

建立 `backend/tests/contact.test.js`：
```javascript
const request = require('supertest');
const app = require('../server');

// Mock fetch（Node 18+ 內建）
global.fetch = jest.fn();

describe('POST /api/contact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_URL = 'https://hooks.example.com/test';
  });

  test('缺少必填欄位應回傳 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: '王小明' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('Email 格式錯誤應回傳 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: '王小明', email: 'not-an-email', message: '問題' });
    expect(res.status).toBe(400);
  });

  test('合法請求應發送 Webhook 並回傳 200', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    const res = await request(app)
      .post('/api/contact')
      .send({ name: '王小明', email: 'user@example.com', message: '我需要協助', chatHistory: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.example.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  test('Webhook 失敗時仍回傳 200（表單已收到）', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app)
      .post('/api/contact')
      .send({ name: '王小明', email: 'user@example.com', message: '問題' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/contact.test.js --verbose
```

Expected: FAIL（`Cannot find module '../routes/contact'`）

- [ ] **Step 3: 實作 contact.js**

建立 `backend/routes/contact.js`：
```javascript
const express = require('express');
const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/', async (req, res) => {
  const { name, email, message, chatHistory = [] } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: '請填寫姓名、Email 與問題描述' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email 格式不正確' });
  }

  const payload = {
    name,
    email,
    message,
    chatHistory,
    timestamp: new Date().toISOString()
  };

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Webhook 發送失敗:', err.message);
    }
  }

  res.json({ success: true, message: '已收到您的留言，我們將盡快與您聯繫' });
});

module.exports = router;
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/contact.test.js --verbose
```

Expected: 所有 4 個測試 PASS

- [ ] **Step 5: 執行全部測試**

```bash
cd D:/2026/Claude/project1/backend
npx jest --verbose
```

Expected: 所有測試（rag + claude + chat + contact）全部 PASS

- [ ] **Step 6: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/routes/contact.js backend/tests/contact.test.js
git commit -m "feat: add /api/contact route with webhook notification"
```

---

## Task 6: 前端 Widget

**Files:**
- Create: `frontend/widget.js`
- Create: `frontend/demo.html`

- [ ] **Step 1: 建立 widget.js**

建立 `frontend/widget.js`：
```javascript
(function () {
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
    .typing { color: #9ca3af; font-style: italic; }
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

    addMessage(role, text) {
      const messages = this.shadow.getElementById('messages');
      const bubble = document.createElement('div');
      bubble.className = `bubble ${role}`;
      bubble.textContent = text;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
      return bubble;
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
        this.addMessage('assistant', data.reply);

        if (data.needsHuman) {
          this.showContactForm();
        }
      } catch {
        this.removeTyping();
        this.addMessage('assistant', '抱歉，連線發生錯誤，請稍後再試。');
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
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
```

- [ ] **Step 2: 建立 demo.html**

建立 `frontend/demo.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>智能客服 Widget 示範</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 60px auto;
      padding: 0 20px;
      color: #111;
    }
    h1 { font-size: 28px; }
    p { color: #555; line-height: 1.7; }
  </style>
</head>
<body>
  <h1>示範網站</h1>
  <p>這是一個靜態網頁示範。右下角的聊天按鈕即為智能客服 Widget。</p>
  <p>點擊 💬 按鈕開始對話，試試輸入「如何退款」或「配送需要幾天」。</p>
  <script src="http://localhost:3001/widget.js"></script>
</body>
</html>
```

- [ ] **Step 3: 手動測試 Widget**

1. 啟動後端：
```bash
cd D:/2026/Claude/project1/backend
node server.js
```

2. 瀏覽器開啟 `D:/2026/Claude/project1/frontend/demo.html`
3. 確認右下角出現 💬 按鈕
4. 點擊展開聊天視窗
5. 輸入「如何退款？」→ 確認收到 AI 回覆
6. 確認 loading 動畫正常顯示

- [ ] **Step 4: Commit**

```bash
cd D:/2026/Claude/project1
git add frontend/widget.js frontend/demo.html
git commit -m "feat: add vanilla JS chat widget with Shadow DOM"
```

---

## Task 7: 整合驗收測試

**Files:**
- 無新增檔案，驗收現有功能

- [ ] **Step 1: 執行所有後端單元測試**

```bash
cd D:/2026/Claude/project1/backend
npx jest --verbose
```

Expected: 所有測試 PASS，無任何 FAIL

- [ ] **Step 2: 啟動後端測試完整流程**

```bash
cd D:/2026/Claude/project1/backend
node server.js
```

確認輸出：`Server running on port 3001`

- [ ] **Step 3: 測試 /api/chat 端點**

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"如何申請退款？","history":[]}'
```

Expected: `{"reply":"...","needsHuman":false}`

- [ ] **Step 4: 測試 /api/contact 端點**

```bash
curl -X POST http://localhost:3001/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"測試","email":"test@example.com","message":"我需要協助","chatHistory":[]}'
```

Expected: `{"success":true,"message":"已收到您的留言，我們將盡快與您聯繫"}`

- [ ] **Step 5: 測試輸入驗證**

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 400，`{"error":"請提供 message 欄位"}`

- [ ] **Step 6: 最終 Commit**

```bash
cd D:/2026/Claude/project1
git add .
git commit -m "feat: complete chat widget MVP - all tests passing"
```

---

## 完成標準

- [ ] 所有 Jest 測試通過（rag + claude + chat + contact）
- [ ] 後端正常啟動，三個端點可存取
- [ ] 前端 widget 嵌入 demo.html 後正常顯示
- [ ] AI 能根據知識庫回答問題
- [ ] 無法回答時自動顯示人工客服表單
- [ ] 表單送出後觸發 Webhook
