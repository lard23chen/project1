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
