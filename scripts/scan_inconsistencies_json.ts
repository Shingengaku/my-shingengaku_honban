import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scanInconsistencies() {
  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, input_name, venue, social_venue, applied_rank_name, participation_type, created_at, remarks')
    .order('created_at', { ascending: false });

  if (error) {
    fs.writeFileSync('scan_result.json', JSON.stringify({ error }));
    return;
  }

  const issueTypeAndVenue = apps.filter(app => {
    if (app.participation_type === 'venue' && (app.venue?.includes('LIVE') || app.venue?.includes('アーカイブ'))) return true;
    if (app.participation_type === 'online' && !app.venue?.includes('LIVE') && !app.venue?.includes('アーカイブ') && app.venue !== 'none') return true;
    return false;
  });

  const issueProductMismatch = apps.filter(app => {
      if (app.remarks?.includes('【LIVE視聴会場】') && app.participation_type === 'venue') return true;
      return false;
  });
  
  const issueOnlineSocial = apps.filter(app => {
      if (app.participation_type === 'online' && app.social_venue && app.social_venue !== 'none' && app.social_venue !== '参加しません' && app.social_venue !== '参加しない' && app.social_venue !== 'ー') return true;
      return false;
  });

  const missingType = apps.filter(app => !app.participation_type);

  const result = {
    total: apps.length,
    issueTypeAndVenue: { count: issueTypeAndVenue.length, samples: issueTypeAndVenue.slice(0, 10) },
    issueProductMismatch: { count: issueProductMismatch.length, samples: issueProductMismatch.slice(0, 10) },
    issueOnlineSocial: { count: issueOnlineSocial.length, samples: issueOnlineSocial.slice(0, 10) },
    missingType: { count: missingType.length }
  };

  fs.writeFileSync('scan_result.json', JSON.stringify(result, null, 2), 'utf-8');
}

scanInconsistencies();
