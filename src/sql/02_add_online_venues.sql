-- 1. Dev環境等でカラムが未定義だった場合のために、participation_type カラムを追加
ALTER TABLE applications ADD COLUMN IF NOT EXISTS participation_type TEXT;

-- 2. online_venues（オンライン配信対象会場）カラムの追加
ALTER TABLE applications ADD COLUMN IF NOT EXISTS online_venues TEXT;

-- 3. 既存の備考欄に紛れ込んでいる会場名データを切り出して、新しいカラムにお引越し
UPDATE applications
SET 
    -- 備考欄から「東京・福岡」などの文字を切り出して設定
    online_venues = trim(substring(remarks from '【LIVE視聴会場】\\s*([^\\n]+)')),
    -- 元の備考欄からはその行をごっそり削除する
    remarks = trim(regexp_replace(remarks, '【LIVE視聴会場】\\s*[^\\n]+', ''))
WHERE 
    remarks LIKE '%【LIVE視聴会場】%';

-- 4. （もし空になった備考欄があれば）空文字をNULLにキレイに整える
UPDATE applications
SET remarks = NULL
WHERE remarks = '';

-- 5. SupabaseのAPIキャッシュを強制リロードさせて変更を即時反映する
NOTIFY pgrst, 'reload schema';
