-- applications テーブルに自己参照外部キーである parent_application_id カラムを追加する
-- ON DELETE SET NULL により、親レコードが削除された場合は子の紐付けを解除する
ALTER TABLE public.applications 
ADD COLUMN parent_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;

-- 検索などのクエリを最適化するためにインデックスを作成
CREATE INDEX IF NOT EXISTS idx_applications_parent_application_id 
ON public.applications(parent_application_id);
