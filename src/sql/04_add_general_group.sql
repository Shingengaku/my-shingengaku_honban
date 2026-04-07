-- 属性マスタの集計グループ制約を更新 (general を追加)
ALTER TABLE ranks DROP CONSTRAINT IF EXISTS ranks_group_check;
ALTER TABLE ranks ADD CONSTRAINT ranks_group_check CHECK ("group" IN ('tokushin', 'terms', 'general', 'executive', 'referral'));

-- 初期値の設定 (必要に応じて、既存の一般/未受講を general に一括設定)
UPDATE ranks SET "group" = 'general' WHERE name LIKE '%一般%' OR name LIKE '%未受講%';
