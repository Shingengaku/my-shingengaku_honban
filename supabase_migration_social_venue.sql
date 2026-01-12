
-- Add social_venue column
alter table applications add column social_venue text check (social_venue in ('none', 'tokyo', 'fukuoka', 'both'));
-- Update existing rows based on attend_social boolean (migration logic)
update applications set social_venue = case 
  when attend_social = false then 'none'
  when attend_social = true and venue = 'tokyo' then 'tokyo'
  when attend_social = true and venue = 'fukuoka' then 'fukuoka'
  when attend_social = true and venue = 'both' then 'both'
  else 'none'
end;
-- (Optional) If you want to drop the old column later, do it. keeping it for now to avoid breakage until code is deployed.
