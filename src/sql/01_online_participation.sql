-- online_options テーブルを作成
create table if not exists online_options (
  id bigint primary key generated always as identity,
  name text not null,
  type text not null check (type in ('live', 'archive')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 初期データを挿入
insert into online_options (name, type, sort_order) values
('LIVE視聴', 'live', 10),
('アーカイブ視聴', 'archive', 20)
on conflict do nothing; -- 名前が一意であった場合の最小限の競合チェックですが、ここでは安全に実行します

-- applications テーブルに participation_type を追加
alter table applications add column if not exists participation_type text;
-- チェック制約はオプションですが、推奨されます

-- alter table applications add constraint check_participation_type check (participation_type in ('venue', 'online'));
