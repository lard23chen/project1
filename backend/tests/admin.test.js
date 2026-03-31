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
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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
