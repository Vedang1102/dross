const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database in data folder
const dbPath = path.join(__dirname, '../data/dross.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  // Conversations table
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      mode TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User profile table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database initialized');
});

// Save message
const saveMessage = (sessionId, role, content, mood = null, mode = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO conversations (session_id, role, content, mood, mode) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, role, content, mood, mode],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Get conversation history
const getConversationHistory = (sessionId, limit = 20) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [sessionId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse()); // Chronological order
      }
    );
  });
};

// Get all sessions
const getAllSessions = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT session_id, 
       MIN(timestamp) as started_at,
       MAX(timestamp) as last_message_at,
       COUNT(*) as message_count
       FROM conversations 
       GROUP BY session_id 
       ORDER BY last_message_at DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

module.exports = {
  db,
  saveMessage,
  getConversationHistory,
  getAllSessions
};
