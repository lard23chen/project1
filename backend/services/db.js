const mongoose = require('mongoose');

// ── Schemas ──────────────────────────────────────────────
const conversationSchema = new mongoose.Schema({
  user_message: { type: String, required: true },
  ai_reply:     { type: String, required: true },
  needs_human:  { type: Boolean, default: false },
  created_at:   { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true },
  message:    { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Contact      = mongoose.model('Contact', contactSchema);

// ── Init ─────────────────────────────────────────────────
async function initDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI 環境變數未設定');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

// ── Writes ────────────────────────────────────────────────
async function saveConversation(userMessage, aiReply, needsHuman) {
  await Conversation.create({ user_message: userMessage, ai_reply: aiReply, needs_human: !!needsHuman });
}

async function saveContact(name, email, message) {
  await Contact.create({ name, email, message });
}

// ── Reads ─────────────────────────────────────────────────
async function getStats() {
  const [total, aiResolved, needsHuman, todayCount, dailyCounts, topQuestions] = await Promise.all([
    Conversation.countDocuments(),
    Conversation.countDocuments({ needs_human: false }),
    Conversation.countDocuments({ needs_human: true }),
    Conversation.countDocuments({ created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Conversation.aggregate([
      { $match: { created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } }
    ]),
    Conversation.aggregate([
      { $group: { _id: '$user_message', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, question: '$_id', count: 1 } }
    ])
  ]);

  const resolutionRate = total === 0 ? 0 : Math.round((aiResolved / total) * 100);
  return { total, aiResolved, needsHuman, todayCount, resolutionRate, dailyCounts, topQuestions };
}

async function getLogs({ date, filter, page = 1, limit = 20 } = {}) {
  const query = {};
  if (date) {
    const start = new Date(date);
    const end   = new Date(date);
    end.setDate(end.getDate() + 1);
    query.created_at = { $gte: start, $lt: end };
  }
  if (filter === 'human') query.needs_human = true;

  const offset = (page - 1) * limit;
  const [total, rawData] = await Promise.all([
    Conversation.countDocuments(query),
    Conversation.find(query).sort({ created_at: -1 }).skip(offset).limit(limit).lean()
  ]);

  // 保持與原 SQLite 欄位相容
  const data = rawData.map(r => ({
    id:           r._id.toString(),
    user_message: r.user_message,
    ai_reply:     r.ai_reply,
    needs_human:  r.needs_human ? 1 : 0,
    created_at:   r.created_at.toISOString()
  }));

  return { total, page, data };
}

async function closeDb() {
  await mongoose.disconnect();
}

module.exports = { initDb, saveConversation, saveContact, getStats, getLogs, closeDb };
