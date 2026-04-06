
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugRanks() {
    console.log('--- Ranks (Masters) ---');
    const { data: ranks } = await supabase.from('ranks').select('*');
    ranks.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}`));

    console.log('\n--- Payment Links (Master Settings) ---');
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    settings.value.forEach((p, idx) => {
        console.log(`[${idx}] Name: ${p.name}`);
        console.log(`    Rank (Attribute) ID: ${p.rank_id || 'NULL (BRITTLE!)'}`);
    });
}

debugRanks();
