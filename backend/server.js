require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));

app.use(express.json({ limit: '10kb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '請求過於頻繁，請稍後再試' }
}));

app.use('/api/chat', require('./routes/chat'));
app.use('/api/contact', require('./routes/contact'));

app.use(express.static('../frontend'));

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
