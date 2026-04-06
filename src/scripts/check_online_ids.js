
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOnline() {
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    if (!settings) return;
    
    console.log('--- ONLINE PRODUCTS IN MASTER ---');
    settings.value.forEach((p, idx) => {
        if (p.venue_lecture === 'LIVE視聴' || p.name.includes('視聴') || p.name.includes('ライブ')) {
            console.log(`[${idx}] Name: ${p.name}, rank_id: ${p.rank_id}`);
        }
    });
}

checkOnline();
