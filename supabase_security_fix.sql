-- ==========================================
-- Supabase セキュリティ対策・実行SQL
-- 実施日: 2026-04-16
-- 内容: 全テーブルのRLS（行レベルセキュリティ）有効化
-- ==========================================

-- 1. 全テーブルのRLSを有効化します（ドアに鍵をかける）
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_options ENABLE ROW LEVEL SECURITY;

-- 2. 過去に作成された可能性のある「誰でも操作できる設定」を削除して、セキュリティを盤石にします
DROP POLICY IF EXISTS "Allow public read" ON app_settings;
DROP POLICY IF EXISTS "Allow public insert" ON app_settings;
DROP POLICY IF EXISTS "Allow public update" ON app_settings;

-- これで設定は完了です。
-- 追加のポリシー（許可証）を作成しない限り、外部（anonキー）からのアクセスはすべて拒否されます。
-- 内部システム（service_roleキー）は引き続きすべての操作が可能です。
