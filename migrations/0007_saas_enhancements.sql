-- 1. saas_plans テーブルの作成
CREATE TABLE IF NOT EXISTS saas_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    member_limit INTEGER NOT NULL,
    channel_limit INTEGER NOT NULL,
    storage_limit INTEGER NOT NULL,
    dm_enabled INTEGER NOT NULL DEFAULT 1,
    media_enabled INTEGER NOT NULL DEFAULT 1,
    forbidden_extensions TEXT DEFAULT '',
    price_id TEXT,
    price_amount INTEGER DEFAULT 0,
    price_currency TEXT DEFAULT 'jpy',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期プランのインサート
INSERT OR IGNORE INTO saas_plans (id, name, member_limit, channel_limit, storage_limit, dm_enabled, media_enabled, forbidden_extensions, price_id, price_amount, price_currency)
VALUES ('free', 'Free Plan', 5, 3, 52428800, 1, 1, '', '', 0, 'jpy');

INSERT OR IGNORE INTO saas_plans (id, name, member_limit, channel_limit, storage_limit, dm_enabled, media_enabled, forbidden_extensions, price_id, price_amount, price_currency)
VALUES ('unlimited', 'Unlimited Plan', 9999, 9999, 5368709120, 1, 1, '', '', 0, 'jpy');

-- 2. audit_logs テーブルの作成
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 3. system_settings のデフォルト値追加
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('stripe_enabled', '0');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_saas_plan', 'free');
