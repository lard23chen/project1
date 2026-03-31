# 後台分析儀表板設計文件

**日期：** 2026-03-31
**狀態：** 已確認，待實作

---

## 概述

在現有 Express 後端加入 SQLite 資料儲存，記錄每次對話與人工客服表單。提供密碼保護的後台頁面（`/admin`），顯示統計圖表與對話紀錄，供內部人員分析使用者問題趨勢。

---

## 架構

```
POST /api/chat（現有）
   └── 寫入 SQLite conversations 表 ← 新增

POST /api/contact（現有）
   └── 寫入 SQLite contacts 表 ← 新增

GET  /admin              ← 後台首頁（需登入，導向總覽）
GET  /admin/login        ← 登入頁
POST /admin/login        ← 登入驗證
GET  /admin/logout       ← 登出
GET  /api/admin/stats    ← 統計 API（需登入）
GET  /api/admin/logs     ← 對話紀錄 API（需登入）
```

---

## 新增檔案結構

```
backend/
├── services/
│   └── db.js                  # SQLite 初始化 + CRUD 封裝
├── routes/
│   └── admin.js               # 後台頁面路由 + /api/admin/* API
├── middleware/
│   └── auth.js                # session 登入驗證中介軟體
└── public/
    └── admin.html             # 後台 SPA（Chart.js，純 HTML）
```

---

## 資料庫 Schema

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_message TEXT NOT NULL,
  ai_reply     TEXT NOT NULL,
  needs_human  INTEGER NOT NULL DEFAULT 0,  -- 0=AI回答, 1=轉人工
  created_at   TEXT NOT NULL                -- ISO 8601
);

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## 認證機制

- 帳號密碼存於 `.env`：`ADMIN_USER`、`ADMIN_PASSWORD`
- 使用 `express-session` 管理 session（session secret 也存 `.env`）
- 未登入存取任何 `/admin` 路徑自動 redirect 到 `/admin/login`
- session 有效期限：8 小時

---

## API 規格

### `GET /api/admin/stats`

回傳：
```json
{
  "total": 142,
  "aiResolved": 124,
  "needsHuman": 18,
  "todayCount": 12,
  "resolutionRate": 87,
  "dailyCounts": [
    { "date": "2026-03-25", "count": 18 },
    { "date": "2026-03-26", "count": 22 }
  ],
  "topQuestions": [
    { "question": "如何退票？", "count": 34 }
  ]
}
```

`dailyCounts`：過去 7 天每日對話量
`topQuestions`：以 user_message 欄位精確比對分組，取出現次數最多的前 10 筆（相同問句不同標點視為不同問題）

### `GET /api/admin/logs`

Query 參數：
- `date`（選填）：`YYYY-MM-DD` 篩選特定日期
- `filter`（選填）：`all`（預設）/ `human`（僅轉人工）
- `page`（選填）：頁碼，預設 1
- `limit`（選填）：每頁筆數，預設 20

回傳：
```json
{
  "total": 142,
  "page": 1,
  "data": [
    {
      "id": 1,
      "user_message": "如何退票？",
      "ai_reply": "請在購買後...",
      "needs_human": 0,
      "created_at": "2026-03-31T14:32:00Z"
    }
  ]
}
```

---

## 後台 UI（admin.html）

### 版面：頂部導覽分頁

```
┌─────────────────────────────────────────────┐
│ 📊 智能客服後台        總覽 | 紀錄 | 登出   │
├─────────────────────────────────────────────┤
│ [總覽 Tab]                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │總對話│ │AI解決│ │轉人工│ │今日數│       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│  ┌─────────────────┐ ┌─────────────────┐   │
│  │ 7天折線圖       │ │ 熱門問題 TOP10  │   │
│  └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────┤
│ [紀錄 Tab]                                  │
│  篩選：日期 [____] 狀態 [全部 ▼] [查詢]    │
│  ┌─────────────────────────────────────┐    │
│  │ 時間 │ 問題 │ 回覆 │ 狀態           │    │
│  ├──────┼──────┼──────┼───────────────┤    │
│  │ ...  │ ...  │ ...  │ ✅ / ⚠️       │    │
│  └─────────────────────────────────────┘    │
│  [上一頁] 第 1/8 頁 [下一頁]               │
└─────────────────────────────────────────────┘
```

技術：純 HTML + CSS + Chart.js CDN，不需要 build 流程

---

## 環境變數新增（.env）

```
ADMIN_USER=admin
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret_string
DB_PATH=./data/chat.db
```

---

## 現有程式碼修改

| 檔案 | 修改內容 |
|------|----------|
| `routes/chat.js` | 對話完成後呼叫 `db.saveConversation()` |
| `routes/contact.js` | 表單送出後呼叫 `db.saveContact()` |
| `server.js` | 加入 express-session、掛載 `/admin` 路由 |

---

## 技術堆疊新增

| 項目 | 技術 |
|------|------|
| 資料庫 | SQLite（better-sqlite3） |
| Session | express-session |
| 圖表 | Chart.js（CDN） |
| 後台 UI | 純 HTML + CSS |
