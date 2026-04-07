const express = require('express');
const router = express.Router();
const { search } = require('../services/rag');
const { askClaude } = require('../services/claude');
const { saveConversation, getAllKnowledge } = require('../services/db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '請提供 message 欄位' });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: '訊息長度不能超過 500 字' });
  }

  const knowledge = await getAllKnowledge();
  const relevant = search(knowledge, message);
  const result = await askClaude(client, relevant, history, message);

  await saveConversation(message, result.reply, result.needsHuman ? 1 : 0);

  res.json(result);
});

module.exports = router;
