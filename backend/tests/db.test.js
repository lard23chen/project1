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
