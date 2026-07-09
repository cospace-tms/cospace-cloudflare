-- 1. メッセージピン留め管理テーブル
CREATE TABLE IF NOT EXISTS message_pins (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at TEXT NOT NULL
);

-- 2. チャンネル・DMお気に入り（スター）管理テーブル
CREATE TABLE IF NOT EXISTS channel_stars (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  starred_at TEXT NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);
