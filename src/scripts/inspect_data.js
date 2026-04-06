
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
  console.log('--- Inspecting app_settings (payment_links) ---');
  const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
  if (settings && settings.value) {
    const venues = new Set();
    const socials = new Set();
    settings.value.forEach(p => {
      venues.add(p.venue_lecture);
      socials.add(p.venue_social);
    });
    console.log('Unique venue_lecture in payment_links:', Array.from(venues));
    console.log('Unique venue_social in payment_links:', Array.from(socials));
  }

  console.log('\n--- Inspecting applications ---');
  const { data: apps } = await supabase.from('applications').select('venue, social_venue, online_venues').limit(100);
  if (apps) {
    const venues = new Set();
    const socials = new Set();
    const online = new Set();
    apps.forEach(a => {
      venues.add(a.venue);
      socials.add(a.social_venue);
      online.add(a.online_venues);
    });
    console.log('Unique venue in applications:', Array.from(venues));
    console.log('Unique social_venue in applications:', Array.from(socials));
    console.log('Unique online_venues in applications:', Array.from(online));
  }
}

inspectData();
