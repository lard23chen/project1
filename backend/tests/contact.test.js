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
