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
  res.status(401).send(`<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="UTF-8"><title>後台登入</title>
<style>body{font-family:-apple-system,sans-serif;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:#1e293b;padding:40px;border-radius:12px;width:320px}h1{color:white;font-size:20px;margin:0 0 24px;text-align:center}label{color:#94a3b8;font-size:13px;display:block;margin-bottom:4px}input{width:100%;padding:10px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:white;font-size:14px;box-sizing:border-box;margin-bottom:16px}button{width:100%;padding:10px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer}.error{color:#f87171;font-size:13px;margin-bottom:12px;text-align:center}</style>
</head><body><div class="box"><h1>📊 智能客服後台</h1>
<p class="error">帳號或密碼錯誤</p>
<form method="POST" action="/admin/login"><label>帳號</label><input type="text" name="username" required autofocus /><label>密碼</label><input type="password" name="password" required /><button type="submit">登入</button></form>
</div></body></html>`);
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
router.get('/api/admin/stats', requireAuth, async (req, res) => {
  res.json(await getStats());
});

// 對話紀錄 API
router.get('/api/admin/logs', requireAuth, async (req, res) => {
  const { date, filter, page, limit } = req.query;
  res.json(await getLogs({
    date: date || null,
    filter: filter || 'all',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20
  }));
});

module.exports = router;
