-- termsテーブルにsort_orderカラムを追加
alter table public.terms 
add column if not exists sort_order integer default 0;

-- 既存データのsort_orderをID順に初期化
-- (IDが小さい順に 10, 20, 30... と振る例)
with ranked_terms as (
  select id, row_number() over (order by id) as rn
  from public.terms
)
update public.terms
set sort_order = ranked_terms.rn * 10
from ranked_terms
where public.terms.id = ranked_terms.id;
