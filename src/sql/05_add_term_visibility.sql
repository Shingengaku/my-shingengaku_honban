-- terms テーブルに募集受付の有効・無効を判定するフラグを追加します。
-- デフォルトは true (表示/受付中) とし、既存のデータにはすべて true を設定します。

ALTER TABLE terms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 既存の全レコードを確実にアクティブに設定（念のため）
UPDATE terms SET is_active = true WHERE is_active IS NULL;
