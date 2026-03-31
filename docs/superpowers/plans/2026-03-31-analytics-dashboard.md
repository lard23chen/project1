# 後台分析儀表板實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 Express 後端加入 SQLite 對話記錄、登入驗證，以及統計圖表 + 對話紀錄的後台管理頁面（`/admin`）。

**Architecture:** 新增 `services/db.js` 封裝 SQLite 存取，`middleware/auth.js` 保護 admin 路由，`routes/admin.js` 提供後台頁面與統計 API；現有 chat/contact 路由寫入 DB；前端用純 HTML + Chart.js CDN。

**Tech Stack:** better-sqlite3, express-session, Chart.js (CDN), Jest, Supertest

---

## 檔案結構

```
backend/
├── services/
│   └── db.js                    # 新增：SQLite 初始化 + CRUD
├── middleware/
│   └── auth.js                  # 新增：session 登入驗證
├── routes/
│   ├── admin.js                 # 新增：/admin + /api/admin/*
│   ├── chat.js                  # 修改：加入 db.saveConversation()
│   └── contact.js               # 修改：加入 db.saveContact()
├── public/
│   └── admin.html               # 新增：後台 SPA
├── tests/
│   ├── db.test.js               # 新增
│   └── admin.test.js            # 新增
└── server.js                    # 修改：加入 session + admin 路由
```

---

## Task 1: 安裝套件 + 更新環境設定

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: 安裝新套件**

```bash
cd D:/2026/Claude/project1/backend
npm install better-sqlite3 express-session
```

Expected: 安裝成功，無 error

- [ ] **Step 2: 更新 .env 加入新設定**

在 `backend/.env` 末尾加入：
```
ADMIN_USER=admin
ADMIN_PASSWORD=admin1234
SESSION_SECRET=change-this-to-a-random-string-in-production
DB_PATH=./data/chat.db
```

- [ ] **Step 3: 更新 .env.example**

在 `backend/.env.example` 末尾加入：
```
ADMIN_USER=admin
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret_string
DB_PATH=./data/chat.db
```

- [ ] **Step 4: 建立 middleware 和 public 目錄**

```bash
mkdir -p D:/2026/Claude/project1/backend/middleware
mkdir -p D:/2026/Claude/project1/backend/public
```

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/package.json backend/.env.example
git commit -m "feat: install better-sqlite3 and express-session for admin dashboard"
```

---

## Task 2: SQLite 資料庫服務

**Files:**
- Create: `backend/services/db.js`
- Create: `backend/tests/db.test.js`

- [ ] **Step 1: 撰寫 db.test.js**

建立 `backend/tests/db.test.js`：
```javascript
const path = require('path');
const fs = require('fs');

// 使用測試用暫時 DB
const TEST_DB = path.join(__dirname, '../data/test-chat.db');
process.env.DB_PATH = TEST_DB;

const { initDb, saveConversation, saveContact, getStats, getLogs, closeDb } = require('../services/db');

describe('DB Service', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  test('saveConversation 應儲存對話並可查詢', () => {
    saveConversation('如何退票？', '請在7天內申請', 0);
    saveConversation('特殊問題', '需要客服協助', 1);
    const stats = getStats();
    expect(stats.total).toBe(2);
    expect(stats.aiResolved).toBe(1);
    expect(stats.needsHuman).toBe(1);
  });

  test('saveContact 應儲存表單資料', () => {
    saveContact('王小明', 'test@example.com', '我需要協助');
    // 確認不拋出錯誤即通過
  });

  test('getStats 應回傳正確統計資料結構', () => {
    const stats = getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('aiResolved');
    expect(stats).toHaveProperty('needsHuman');
    expect(stats).toHaveProperty('todayCount');
    expect(stats).toHaveProperty('resolutionRate');
    expect(Array.isArray(stats.dailyCounts)).toBe(true);
    expect(Array.isArray(stats.topQuestions)).toBe(true);
  });

  test('resolutionRate 計算正確', () => {
    const stats = getStats();
    expect(stats.resolutionRate).toBe(50); // 1/2 = 50%
  });

  test('getLogs 預設回傳所有紀錄', () => {
    const result = getLogs({});
    expect(result.total).toBe(2);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toHaveProperty('user_message');
    expect(result.data[0]).toHaveProperty('ai_reply');
    expect(result.data[0]).toHaveProperty('needs_human');
    expect(result.data[0]).toHaveProperty('created_at');
  });

  test('getLogs filter=human 只回傳轉人工', () => {
    const result = getLogs({ filter: 'human' });
    expect(result.total).toBe(1);
    expect(result.data[0].needs_human).toBe(1);
  });

  test('getLogs 分頁正確', () => {
    const result = getLogs({ page: 1, limit: 1 });
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(2);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/db.test.js --verbose
```

Expected: FAIL（`Cannot find module '../services/db'`）

- [ ] **Step 3: 實作 db.js**

建立 `backend/services/db.js`：
```javascript
const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDb() {
  const dbPath = path.resolve(process.env.DB_PATH || './data/chat.db');
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_message TEXT NOT NULL,
      ai_reply     TEXT NOT NULL,
      needs_human  INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

function saveConversation(userMessage, aiReply, needsHuman) {
  const stmt = getDb().prepare(
    'INSERT INTO conversations (user_message, ai_reply, needs_human, created_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(userMessage, aiReply, needsHuman ? 1 : 0, new Date().toISOString());
}

function saveContact(name, email, message) {
  const stmt = getDb().prepare(
    'INSERT INTO contacts (name, email, message, created_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(name, email, message, new Date().toISOString());
}

function getStats() {
  const d = getDb();
  const total = d.prepare('SELECT COUNT(*) as n FROM conversations').get().n;
  const aiResolved = d.prepare('SELECT COUNT(*) as n FROM conversations WHERE needs_human = 0').get().n;
  const needsHuman = d.prepare('SELECT COUNT(*) as n FROM conversations WHERE needs_human = 1').get().n;
  const todayCount = d.prepare(
    "SELECT COUNT(*) as n FROM conversations WHERE date(created_at) = date('now')"
  ).get().n;
  const resolutionRate = total === 0 ? 0 : Math.round((aiResolved / total) * 100);

  const dailyCounts = d.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM conversations
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  const topQuestions = d.prepare(`
    SELECT user_message as question, COUNT(*) as count
    FROM conversations
    GROUP BY user_message
    ORDER BY count DESC
    LIMIT 10
  `).all();

  return { total, aiResolved, needsHuman, todayCount, resolutionRate, dailyCounts, topQuestions };
}

function getLogs({ date, filter, page = 1, limit = 20 } = {}) {
  const d = getDb();
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];

  if (date) {
    where += ' AND date(created_at) = ?';
    params.push(date);
  }
  if (filter === 'human') {
    where += ' AND needs_human = 1';
  }

  const total = d.prepare(`SELECT COUNT(*) as n FROM conversations WHERE ${where}`).get(...params).n;
  const data = d.prepare(
    `SELECT * FROM conversations WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { total, page, data };
}

function closeDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { initDb, saveConversation, saveContact, getStats, getLogs, closeDb };
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/db.test.js --verbose
```

Expected: 所有 7 個測試 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/services/db.js backend/tests/db.test.js
git commit -m "feat: add SQLite database service with conversation and stats support"
```

---

## Task 3: 認證中介軟體 + 更新 server.js

**Files:**
- Create: `backend/middleware/auth.js`
- Modify: `backend/server.js`

- [ ] **Step 1: 建立 auth.js**

建立 `backend/middleware/auth.js`：
```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/admin/login');
}

module.exports = { requireAuth };
```

- [ ] **Step 2: 更新 server.js**

將 `backend/server.js` 完整替換為：
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
const { initDb } = require('./services/db');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '請求過於頻繁，請稍後再試' }
}));

app.use('/api/chat', require('./routes/chat'));
app.use('/api/contact', require('./routes/contact'));
app.use('/', require('./routes/admin'));

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, 'public')));

initDb();

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 3: 確認語法正確**

```bash
cd D:/2026/Claude/project1/backend
node -e "require('./server.js'); console.log('OK')" 2>&1
```

Expected: `OK`（無 error）

- [ ] **Step 4: 確認所有既有測試仍通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/rag.test.js tests/claude.test.js tests/chat.test.js tests/contact.test.js --verbose
```

Expected: 18 個測試全部 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/middleware/auth.js backend/server.js
git commit -m "feat: add session middleware and requireAuth guard for admin routes"
```

---

## Task 4: Admin 路由

**Files:**
- Create: `backend/routes/admin.js`
- Create: `backend/tests/admin.test.js`

- [ ] **Step 1: 撰寫 admin.test.js**

建立 `backend/tests/admin.test.js`：
```javascript
const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '../data/test-admin.db');
process.env.DB_PATH = TEST_DB;
process.env.ADMIN_USER = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpass';

const { initDb, saveConversation, closeDb } = require('../services/db');
const app = require('../server');

describe('Admin Routes', () => {
  let agent;

  beforeAll(() => {
    initDb();
    saveConversation('退票問題', 'AI回答', 0);
    saveConversation('付款問題', '需要客服', 1);
    agent = request.agent(app);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  test('未登入訪問 /admin 應 redirect 到 /admin/login', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });

  test('GET /admin/login 應回傳登入頁面 HTML', async () => {
    const res = await request(app).get('/admin/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<form');
  });

  test('POST /admin/login 帳密錯誤應回傳 401', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send('username=wrong&password=wrong')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(401);
  });

  test('POST /admin/login 正確帳密應 redirect 到 /admin', async () => {
    const res = await agent
      .post('/admin/login')
      .send('username=testadmin&password=testpass')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('登入後訪問 /api/admin/stats 應回傳統計資料', async () => {
    const res = await agent.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.needsHuman).toBe(1);
    expect(Array.isArray(res.body.dailyCounts)).toBe(true);
    expect(Array.isArray(res.body.topQuestions)).toBe(true);
  });

  test('登入後訪問 /api/admin/logs 應回傳對話紀錄', async () => {
    const res = await agent.get('/api/admin/logs');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('/api/admin/logs?filter=human 只回傳轉人工', async () => {
    const res = await agent.get('/api/admin/logs?filter=human');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].needs_human).toBe(1);
  });

  test('GET /admin/logout 應清除 session 並 redirect', async () => {
    const res = await agent.get('/admin/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/admin.test.js --verbose
```

Expected: FAIL（`Cannot find module '../routes/admin'` 或路由未定義）

- [ ] **Step 3: 實作 admin.js**

建立 `backend/routes/admin.js`：
```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getStats, getLogs } = require('../services/db');

// 登入頁
router.get('/admin/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/admin');
  res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>後台登入</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #1e293b; padding: 40px; border-radius: 12px; width: 320px; }
  h1 { color: white; font-size: 20px; margin: 0 0 24px; text-align: center; }
  label { color: #94a3b8; font-size: 13px; display: block; margin-bottom: 4px; }
  input { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: white; font-size: 14px; box-sizing: border-box; margin-bottom: 16px; }
  button { width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
  button:hover { background: #2563eb; }
  .error { color: #f87171; font-size: 13px; margin-bottom: 12px; text-align: center; }
</style>
</head>
<body>
<div class="box">
  <h1>📊 智能客服後台</h1>
  ${req.query.error ? '<p class="error">帳號或密碼錯誤</p>' : ''}
  <form method="POST" action="/admin/login">
    <label>帳號</label>
    <input type="text" name="username" required autofocus />
    <label>密碼</label>
    <input type="password" name="password" required />
    <button type="submit">登入</button>
  </form>
</div>
</body>
</html>`);
});

// 登入驗證
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/admin');
  }
  res.status(401).redirect('/admin/login?error=1');
});

// 登出
router.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// 後台首頁（提供 admin.html）
router.get('/admin', requireAuth, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/admin.html'));
});

// 統計 API
router.get('/api/admin/stats', requireAuth, (req, res) => {
  res.json(getStats());
});

// 對話紀錄 API
router.get('/api/admin/logs', requireAuth, (req, res) => {
  const { date, filter, page, limit } = req.query;
  res.json(getLogs({
    date: date || null,
    filter: filter || 'all',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20
  }));
});

module.exports = router;
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest tests/admin.test.js --verbose
```

Expected: 所有 8 個測試 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/routes/admin.js backend/tests/admin.test.js
git commit -m "feat: add admin routes with login, stats API, and logs API"
```

---

## Task 5: 更新 chat.js 和 contact.js 寫入 DB

**Files:**
- Modify: `backend/routes/chat.js`
- Modify: `backend/routes/contact.js`
- Modify: `backend/tests/chat.test.js`
- Modify: `backend/tests/contact.test.js`

- [ ] **Step 1: 更新 chat.js**

將 `backend/routes/chat.js` 完整替換為：
```javascript
const express = require('express');
const path = require('path');
const router = express.Router();
const { loadKnowledge, search } = require('../services/rag');
const { askClaude } = require('../services/claude');
const { saveConversation } = require('../services/db');
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

  saveConversation(message, result.reply, result.needsHuman ? 1 : 0);

  res.json(result);
});

module.exports = router;
```

- [ ] **Step 2: 更新 contact.js**

將 `backend/routes/contact.js` 完整替換為：
```javascript
const express = require('express');
const router = express.Router();
const { saveContact } = require('../services/db');

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
    name, email, message, chatHistory,
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

  saveContact(name, email, message);

  res.json({ success: true, message: '已收到您的留言，我們將盡快與您聯繫' });
});

module.exports = router;
```

- [ ] **Step 3: 更新 chat.test.js 加入 db mock**

在 `backend/tests/chat.test.js` 頂部加入 db mock（在現有 claude mock 之後）：
```javascript
const request = require('supertest');

jest.mock('../services/claude', () => ({
  askClaude: jest.fn()
}));

jest.mock('../services/db', () => ({
  saveConversation: jest.fn(),
  initDb: jest.fn()
}));

const { askClaude } = require('../services/claude');
const app = require('../server');
// ... 以下保持不變
```

- [ ] **Step 4: 更新 contact.test.js 加入 db mock**

在 `backend/tests/contact.test.js` 頂部 `global.fetch = jest.fn()` 之後加入：
```javascript
jest.mock('../services/db', () => ({
  saveContact: jest.fn(),
  initDb: jest.fn()
}));
```

- [ ] **Step 5: 執行全部測試確認通過**

```bash
cd D:/2026/Claude/project1/backend
npx jest --verbose 2>&1 | grep -E "Tests:|PASS|FAIL"
```

Expected: 所有測試 PASS（rag + claude + chat + contact + db + admin）

- [ ] **Step 6: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/routes/chat.js backend/routes/contact.js backend/tests/chat.test.js backend/tests/contact.test.js
git commit -m "feat: save conversations and contacts to SQLite on each request"
```

---

## Task 6: 後台前端頁面 (admin.html)

**Files:**
- Create: `backend/public/admin.html`

- [ ] **Step 1: 建立 admin.html**

建立 `backend/public/admin.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>智能客服後台</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  nav { background: #1e293b; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 56px; border-bottom: 1px solid #334155; }
  nav h1 { font-size: 16px; font-weight: 700; }
  .tabs { display: flex; gap: 4px; }
  .tab { padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #94a3b8; border: none; background: none; }
  .tab.active { background: #3b82f6; color: white; }
  .logout { color: #94a3b8; font-size: 13px; text-decoration: none; padding: 6px 12px; border-radius: 6px; }
  .logout:hover { background: #334155; }
  main { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .panel { display: none; }
  .panel.active { display: block; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; }
  .card .label { font-size: 12px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  .card .value { font-size: 28px; font-weight: 700; }
  .card .value.blue { color: #60a5fa; }
  .card .value.green { color: #34d399; }
  .card .value.red { color: #f87171; }
  .card .value.yellow { color: #fbbf24; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .chart-box { background: #1e293b; border-radius: 12px; padding: 20px; }
  .chart-box h3 { font-size: 14px; color: #94a3b8; margin-bottom: 16px; }
  .top-list { list-style: none; }
  .top-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 13px; }
  .top-list li:last-child { border: none; }
  .top-list .count { background: #334155; padding: 2px 8px; border-radius: 9999px; font-size: 11px; color: #94a3b8; }
  .filters { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
  .filters input, .filters select { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
  .filters button { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
  th { background: #334155; padding: 12px 16px; text-align: left; font-size: 12px; color: #94a3b8; text-transform: uppercase; }
  td { padding: 12px 16px; border-bottom: 1px solid #1e293b; font-size: 13px; vertical-align: top; }
  tr:hover td { background: #243247; }
  .badge { padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .badge.ai { background: #064e3b; color: #34d399; }
  .badge.human { background: #450a0a; color: #f87171; }
  .truncate { max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pagination { display: flex; align-items: center; gap: 12px; margin-top: 16px; font-size: 13px; color: #64748b; }
  .pagination button { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
  .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
</head>
<body>
<nav>
  <h1>📊 智能客服後台</h1>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('overview')">總覽</button>
    <button class="tab" onclick="switchTab('logs')">對話紀錄</button>
  </div>
  <a href="/admin/logout" class="logout">登出</a>
</nav>

<main>
  <!-- 總覽 Tab -->
  <div id="panel-overview" class="panel active">
    <div class="cards">
      <div class="card"><div class="label">總對話數</div><div class="value blue" id="stat-total">-</div></div>
      <div class="card"><div class="label">AI 解決率</div><div class="value green" id="stat-rate">-</div></div>
      <div class="card"><div class="label">轉人工數</div><div class="value red" id="stat-human">-</div></div>
      <div class="card"><div class="label">今日對話</div><div class="value yellow" id="stat-today">-</div></div>
    </div>
    <div class="charts">
      <div class="chart-box">
        <h3>過去 7 天對話量</h3>
        <canvas id="chart-daily" height="160"></canvas>
      </div>
      <div class="chart-box">
        <h3>熱門問題 TOP 10</h3>
        <ul class="top-list" id="top-questions"></ul>
      </div>
    </div>
  </div>

  <!-- 紀錄 Tab -->
  <div id="panel-logs" class="panel">
    <div class="filters">
      <input type="date" id="filter-date" />
      <select id="filter-status">
        <option value="all">全部狀態</option>
        <option value="human">僅轉人工</option>
      </select>
      <button onclick="loadLogs(1)">查詢</button>
    </div>
    <table>
      <thead><tr><th>時間</th><th>用戶問題</th><th>AI 回覆</th><th>狀態</th></tr></thead>
      <tbody id="logs-body"></tbody>
    </table>
    <div class="pagination">
      <button id="btn-prev" onclick="changePage(-1)" disabled>上一頁</button>
      <span id="page-info">-</span>
      <button id="btn-next" onclick="changePage(1)">下一頁</button>
    </div>
  </div>
</main>

<script>
let currentPage = 1;
let totalPages = 1;
let dailyChart = null;

function switchTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  event.target.classList.add('active');
  if (tab === 'logs') loadLogs(1);
}

async function loadStats() {
  const res = await fetch('/api/admin/stats');
  const d = await res.json();
  document.getElementById('stat-total').textContent = d.total;
  document.getElementById('stat-rate').textContent = d.resolutionRate + '%';
  document.getElementById('stat-human').textContent = d.needsHuman;
  document.getElementById('stat-today').textContent = d.todayCount;

  const labels = d.dailyCounts.map(r => r.date);
  const counts = d.dailyCounts.map(r => r.count);
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(document.getElementById('chart-daily'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: '對話數', data: counts, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#334155' } } } }
  });

  const ul = document.getElementById('top-questions');
  ul.innerHTML = d.topQuestions.map(q =>
    `<li><span class="truncate">${q.question}</span><span class="count">${q.count} 次</span></li>`
  ).join('');
}

async function loadLogs(page) {
  currentPage = page;
  const date = document.getElementById('filter-date').value;
  const filter = document.getElementById('filter-status').value;
  const params = new URLSearchParams({ page, limit: 20, filter });
  if (date) params.set('date', date);

  const res = await fetch('/api/admin/logs?' + params);
  const d = await res.json();

  totalPages = Math.max(1, Math.ceil(d.total / 20));
  document.getElementById('page-info').textContent = `第 ${page}/${totalPages} 頁（共 ${d.total} 筆）`;
  document.getElementById('btn-prev').disabled = page <= 1;
  document.getElementById('btn-next').disabled = page >= totalPages;

  const tbody = document.getElementById('logs-body');
  tbody.innerHTML = d.data.map(row => `
    <tr>
      <td style="white-space:nowrap">${new Date(row.created_at).toLocaleString('zh-TW')}</td>
      <td><div class="truncate">${row.user_message}</div></td>
      <td><div class="truncate">${row.ai_reply}</div></td>
      <td><span class="badge ${row.needs_human ? 'human' : 'ai'}">${row.needs_human ? '⚠️ 轉人工' : '✅ AI 回答'}</span></td>
    </tr>
  `).join('');
}

function changePage(delta) {
  const next = currentPage + delta;
  if (next >= 1 && next <= totalPages) loadLogs(next);
}

loadStats();
</script>
</body>
</html>
```

- [ ] **Step 2: 重啟後端並手動測試登入**

```bash
cd D:/2026/Claude/project1/backend
node server.js
```

瀏覽器開啟 `http://localhost:3001/admin/login`，用以下帳密登入：
- 帳號：`admin`
- 密碼：`admin1234`

Expected: 成功登入並看到後台儀表板

- [ ] **Step 3: 手動測試後台功能**

1. 總覽 Tab 顯示統計卡片（可能全為 0，屬正常）
2. 切換到「對話紀錄」Tab，查詢按鈕有反應
3. 登出後自動導向登入頁

- [ ] **Step 4: Commit**

```bash
cd D:/2026/Claude/project1
git add backend/public/admin.html
git commit -m "feat: add admin dashboard UI with stats charts and conversation logs"
```

---

## Task 7: 整合驗收

**Files:** 無新增

- [ ] **Step 1: 執行所有測試**

```bash
cd D:/2026/Claude/project1/backend
npx jest --verbose 2>&1 | grep -E "Tests:|Test Suites:|PASS|FAIL"
```

Expected:
```
Test Suites: 6 passed, 6 total
Tests:       33 passed, 33 total
```

- [ ] **Step 2: 啟動並端對端測試**

啟動後端：
```bash
cd D:/2026/Claude/project1/backend
node server.js
```

測試登入並取得 stats：
```bash
# 1. 登入取得 cookie
curl -c /tmp/cookie.txt -X POST http://localhost:3001/admin/login \
  -d "username=admin&password=admin1234" \
  -H "Content-Type: application/x-www-form-urlencoded" -v 2>&1 | grep location

# 2. 使用 cookie 取得統計
curl -b /tmp/cookie.txt http://localhost:3001/api/admin/stats
```

Expected: 第一個指令看到 `Location: /admin`，第二個回傳 JSON 統計資料

- [ ] **Step 3: 最終 commit**

```bash
cd D:/2026/Claude/project1
git add .
git commit -m "feat: complete analytics dashboard - all tests passing"
```

---

## 完成標準

- [ ] 所有 Jest 測試通過（6 個 suite，33 個測試）
- [ ] `/admin/login` 登入頁正常顯示
- [ ] 帳密錯誤回傳 401
- [ ] 登入後可看到統計儀表板
- [ ] 對話紀錄可篩選、分頁
- [ ] 每次聊天自動寫入 SQLite
- [ ] 登出後 session 清除
