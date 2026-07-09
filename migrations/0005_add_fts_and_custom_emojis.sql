-- 1. メッセージ全文検索用仮想テーブル
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id,
  content,
  tokenize='trigram'
);

-- 自動同期トリガーの定義
CREATE TRIGGER IF NOT EXISTS after_messages_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(message_id, content) VALUES(new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS after_messages_update AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE message_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS after_messages_delete AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;


-- 2. ドキュメント（ワークスペース/チャンネル）全文検索用仮想テーブル
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  source_type, -- 'workspace' または 'channel'
  source_id, -- workspace_id または channel_id
  title,
  content,
  tokenize='trigram'
);

-- ドキュメント自動同期トリガーの定義
CREATE TRIGGER IF NOT EXISTS after_workspaces_insert AFTER INSERT ON workspaces BEGIN
  INSERT INTO documents_fts(source_type, source_id, title, content) VALUES('workspace', new.id, new.name, COALESCE(new.document, ''));
END;

CREATE TRIGGER IF NOT EXISTS after_workspaces_update AFTER UPDATE ON workspaces BEGIN
  DELETE FROM documents_fts WHERE source_type = 'workspace' AND source_id = old.id;
  INSERT INTO documents_fts(source_type, source_id, title, content) VALUES('workspace', new.id, new.name, COALESCE(new.document, ''));
END;

CREATE TRIGGER IF NOT EXISTS after_workspaces_delete AFTER DELETE ON workspaces BEGIN
  DELETE FROM documents_fts WHERE source_type = 'workspace' AND source_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS after_channels_insert AFTER INSERT ON channels BEGIN
  INSERT INTO documents_fts(source_type, source_id, title, content) VALUES('channel', new.id, new.name, COALESCE(new.document, ''));
END;

CREATE TRIGGER IF NOT EXISTS after_channels_update AFTER UPDATE ON channels BEGIN
  DELETE FROM documents_fts WHERE source_type = 'channel' AND source_id = old.id;
  INSERT INTO documents_fts(source_type, source_id, title, content) VALUES('channel', new.id, new.name, COALESCE(new.document, ''));
END;

CREATE TRIGGER IF NOT EXISTS after_channels_delete AFTER DELETE ON channels BEGIN
  DELETE FROM documents_fts WHERE source_type = 'channel' AND source_id = old.id;
END;


-- 3. 既存データのFTSへの初期流し込み
INSERT OR IGNORE INTO messages_fts (message_id, content)
SELECT id, content FROM messages;

INSERT OR IGNORE INTO documents_fts (source_type, source_id, title, content)
SELECT 'workspace', id, name, COALESCE(document, '') FROM workspaces;

INSERT OR IGNORE INTO documents_fts (source_type, source_id, title, content)
SELECT 'channel', id, name, COALESCE(document, '') FROM channels;


-- 4. カスタム絵文字管理テーブル
CREATE TABLE IF NOT EXISTS custom_emojis (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  code TEXT NOT NULL, -- 例: ':lgtm:'
  url TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, code)
);
