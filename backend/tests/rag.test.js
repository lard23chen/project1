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
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('answer');
  });

  test('search("退票") 應回傳退票相關項目', () => {
    const results = search(knowledge, '如何退票');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('id');
  });

  test('search 回傳筆數最多 5 筆', () => {
    const results = search(knowledge, '訂單付款配送退款帳號發票');
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test('search 完全不相關的問題應回傳空陣列', () => {
    const results = search(knowledge, 'zzzzxxxxxqqqqq');
    expect(results.length).toBe(0);
  });
});
