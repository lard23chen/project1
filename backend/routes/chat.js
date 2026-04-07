const express = require('express');
const path = require('path');
const router = express.Router();
const { loadKnowledge, search } = require('../services/rag');
const { askClaude } = require('../services/claude');
const { saveConversation } = require('../services/db');
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
  console.log(`[chat] knowledge=${knowledge.length} relevant=${relevant.length} query="${message}"`);
  const result = await askClaude(client, relevant, history, message);
  console.log(`[chat] needsHuman=${result.needsHuman} reply="${result.reply.slice(0,50)}"`);

  await saveConversation(message, result.reply, result.needsHuman ? 1 : 0);

  res.json(result);
});

module.exports = router;
