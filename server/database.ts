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

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

const dbPath = path.join(__dirname, '../data/dross.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables with sessions
db.serialize(() => {
  // Sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Conversations table (existing)
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      mode TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
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

  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_session_timestamp ON conversations(session_id, timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mood ON conversations(mood)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mode ON conversations(mode)`);

  console.log('✅ Database initialized with sessions');
});

// Session management
const createSession = (sessionId: string, title: string = 'New Chat'): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO sessions (id, title) VALUES (?, ?)`,
      [sessionId, title],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const getAllSessions = (): Promise<Session[]> => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        s.id,
        s.title,
        s.created_at,
        s.updated_at,
        COUNT(c.id) as message_count
      FROM sessions s
      LEFT JOIN conversations c ON s.id = c.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `, (err, rows: Session[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const updateSessionTitle = (sessionId: string, title: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, sessionId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const deleteSession = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Update session timestamp
const touchSession = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sessionId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// Existing functions
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
        else {
          touchSession(sessionId); // Update session timestamp
          resolve(this.lastID);
        }
      }
    );
  });
};

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

export {
  db,
  saveMessage,
  getConversationHistory,
  createSession,
  getAllSessions,
  updateSessionTitle,
  deleteSession,
  Message,
  Session
};
