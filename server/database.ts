import sqlite3 from 'sqlite3';
import path from 'path';

// Types
interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string | null;
  mode?: string | null;
  timestamp?: string;
}

interface SessionSummary {
  session_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

// Create database in data folder
const dbPath = path.join(__dirname, '../data/dross.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
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
const saveMessage = (
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  mood: string | null = null,
  mode: string | null = null
): Promise<number> => {
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
const getConversationHistory = (
  sessionId: string,
  limit: number = 20
): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [sessionId, limit],
      (err, rows: Message[]) => {
        if (err) reject(err);
        else resolve(rows.reverse());
      }
    );
  });
};

// Get all sessions
const getAllSessions = (): Promise<SessionSummary[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT session_id, 
       MIN(timestamp) as started_at,
       MAX(timestamp) as last_message_at,
       COUNT(*) as message_count
       FROM conversations 
       GROUP BY session_id 
       ORDER BY last_message_at DESC`,
      (err, rows: SessionSummary[]) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

export {
  db,
  saveMessage,
  getConversationHistory,
  getAllSessions,
  Message,
  SessionSummary
};
