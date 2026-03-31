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
