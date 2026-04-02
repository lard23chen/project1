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
  } catch (err) {
    console.error('[askClaude error]', err?.message || err);
    return {
      reply: '很抱歉，系統暫時無法回答，請稍後再試或聯繫客服。',
      needsHuman: true
    };
  }
}

module.exports = { askClaude };
