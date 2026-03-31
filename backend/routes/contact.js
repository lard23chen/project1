const express = require('express');
const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/', async (req, res) => {
  const { name, email, message, chatHistory = [] } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: '請填寫姓名、Email 與問題描述' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email 格式不正確' });
  }

  const payload = {
    name,
    email,
    message,
    chatHistory,
    timestamp: new Date().toISOString()
  };

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Webhook 發送失敗:', err.message);
    }
  }

  res.json({ success: true, message: '已收到您的留言，我們將盡快與您聯繫' });
});

module.exports = router;
