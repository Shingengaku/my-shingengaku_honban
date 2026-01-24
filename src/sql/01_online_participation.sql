-- Create online_options table
create table if not exists online_options (
  id bigint primary key generated always as identity,
  name text not null,
  type text not null check (type in ('live', 'archive')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Insert initial data
insert into online_options (name, type, sort_order) values
('LIVE視聴', 'live', 10),
('アーカイブ視聴', 'archive', 20)
on conflict do nothing; -- minimal conflict check if name was unique, but here just safe run

-- Add participation_type to applications
alter table applications add column if not exists participation_type text;
-- check constraint optional but good practice
-- alter table applications add constraint check_participation_type check (participation_type in ('venue', 'online'));
