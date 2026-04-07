-- 1. 会場マスタにエリア区分を追加
ALTER TABLE venues ADD COLUMN IF NOT EXISTS area TEXT DEFAULT 'tokyo';
-- 値の制約 (tokyo, fukuoka, online)
ALTER TABLE venues ADD CONSTRAINT venues_area_check CHECK (area IN ('tokyo', 'fukuoka', 'online'));

-- 2. 属性マスタに集計グループ区分を追加
ALTER TABLE ranks ADD COLUMN IF NOT EXISTS "group" TEXT DEFAULT 'terms';
-- 値の制約 (tokushin, terms, executive, referral)
ALTER TABLE ranks ADD CONSTRAINT ranks_group_check CHECK ("group" IN ('tokushin', 'terms', 'executive', 'referral'));

-- 3. 既存データのデフォルト設定 (既存のキーワードから推測して初期値を設定 - 必要に応じて)
UPDATE venues SET area = 'tokyo' WHERE name LIKE '%東京%' OR name LIKE '%tokyo%';
UPDATE venues SET area = 'fukuoka' WHERE name LIKE '%福岡%' OR name LIKE '%fukuoka%';
UPDATE venues SET area = 'online' WHERE name LIKE '%LIVE%' OR name LIKE '%オンライン%' OR name LIKE '%アーカイブ%';

UPDATE ranks SET "group" = 'tokushin' WHERE name LIKE '%特進%';
UPDATE ranks SET "group" = 'executive' WHERE name LIKE '%経営幹部%';
UPDATE ranks SET "group" = 'referral' WHERE name LIKE '%紹介%';
