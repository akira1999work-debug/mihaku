import type { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pool',
      memo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      released_at TEXT,
      selected_date TEXT,
      time_slot TEXT NOT NULL DEFAULT 'unset',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      mood INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mood_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      mood INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS release_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      task_title TEXT NOT NULL,
      reason TEXT,
      released_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meeting_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id),
      phase TEXT NOT NULL DEFAULT 'migaku',
      user_message TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      summary_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meeting_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL REFERENCES meeting_logs(id) ON DELETE CASCADE,
      character TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // マイグレーション: 既存DBに time_slot カラムがない場合追加
  try {
    await db.execAsync(
      `ALTER TABLE tasks ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'unset'`
    );
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }
}
