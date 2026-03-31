const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDb() {
  const dbPath = path.resolve(process.env.DB_PATH || './data/chat.db');
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_message TEXT NOT NULL,
      ai_reply     TEXT NOT NULL,
      needs_human  INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

function saveConversation(userMessage, aiReply, needsHuman) {
  const stmt = getDb().prepare(
    'INSERT INTO conversations (user_message, ai_reply, needs_human, created_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(userMessage, aiReply, needsHuman ? 1 : 0, new Date().toISOString());
}

function saveContact(name, email, message) {
  const stmt = getDb().prepare(
    'INSERT INTO contacts (name, email, message, created_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(name, email, message, new Date().toISOString());
}

function getStats() {
  const d = getDb();
  const total = d.prepare('SELECT COUNT(*) as n FROM conversations').get().n;
  const aiResolved = d.prepare('SELECT COUNT(*) as n FROM conversations WHERE needs_human = 0').get().n;
  const needsHuman = d.prepare('SELECT COUNT(*) as n FROM conversations WHERE needs_human = 1').get().n;
  const todayCount = d.prepare(
    "SELECT COUNT(*) as n FROM conversations WHERE date(created_at) = date('now')"
  ).get().n;
  const resolutionRate = total === 0 ? 0 : Math.round((aiResolved / total) * 100);

  const dailyCounts = d.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM conversations
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  const topQuestions = d.prepare(`
    SELECT user_message as question, COUNT(*) as count
    FROM conversations
    GROUP BY user_message
    ORDER BY count DESC
    LIMIT 10
  `).all();

  return { total, aiResolved, needsHuman, todayCount, resolutionRate, dailyCounts, topQuestions };
}

function getLogs({ date, filter, page = 1, limit = 20 } = {}) {
  const d = getDb();
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];

  if (date) {
    where += ' AND date(created_at) = ?';
    params.push(date);
  }
  if (filter === 'human') {
    where += ' AND needs_human = 1';
  }

  const total = d.prepare(`SELECT COUNT(*) as n FROM conversations WHERE ${where}`).get(...params).n;
  const data = d.prepare(
    `SELECT * FROM conversations WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { total, page, data };
}

function closeDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { initDb, saveConversation, saveContact, getStats, getLogs, closeDb };
