-- applicationsテーブルに introducer カラムを追加
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS introducer TEXT;

-- 既存の remarks から introducer を抽出して更新し、remarks から削除するマイグレーション
-- ※紹介者： や 紹介者: が含まれている行を対象にする
UPDATE public.applications
SET 
  introducer = trim(substring(remarks from '紹介者[:：]\s*([^\n]+)')),
  remarks = regexp_replace(remarks, '紹介者[:：]\s*[^\n]*(\n|$)', '', 'g')
WHERE remarks ~ '紹介者[:：]';
