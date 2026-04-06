
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPaymentLinks() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
  if (error) { console.error(error); return; }
  
  data.value.forEach(p => {
    console.log(`- Product: ${p.name}`);
    console.log(`  Venue (Lecture): ${p.venue_lecture}`);
    console.log(`  Venue (Social): ${p.venue_social}`);
    console.log(`  Rank ID: ${p.rank_id}`);
    console.log('---');
  });
}

checkPaymentLinks();
