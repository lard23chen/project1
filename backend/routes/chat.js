const express = require('express');
const path = require('path');
const router = express.Router();
const { loadKnowledge, search } = require('../services/rag');
const { askClaude } = require('../services/claude');
const Anthropic = require('@anthropic-ai/sdk');

const knowledge = loadKnowledge(path.join(__dirname, '../data'));
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '請提供 message 欄位' });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: '訊息長度不能超過 500 字' });
  }

  const relevant = search(knowledge, message);
  const result = await askClaude(client, relevant, history, message);

  res.json(result);
});

module.exports = router;
