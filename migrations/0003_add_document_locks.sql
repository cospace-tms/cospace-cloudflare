CREATE TABLE IF NOT EXISTS document_locks (
  lock_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
