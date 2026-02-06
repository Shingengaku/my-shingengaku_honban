-- membersテーブルにis_tokushinカラムを追加
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS is_tokushin BOOLEAN DEFAULT false;

-- 既存のレコードがある場合、NULLになっているかもしれないので念のためfalseに更新（DEFAULT設定しているので通常は不要だが安全側に倒す）
UPDATE members SET is_tokushin = false WHERE is_tokushin IS NULL;
