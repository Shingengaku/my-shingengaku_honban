
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fullCheck() {
    const { data: ranks } = await supabase.from('ranks').select('*');
    console.log('--- ALL RANKS ---');
    console.table(ranks.map(r => ({ id: r.id, name: r.name })));

    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    if (!settings) return;
    
    console.log('\n--- PAYMENT LINKS WITH NULL rank_id ---');
    settings.value.forEach((p, idx) => {
        if (!p.rank_id) {
            console.log(`[${idx}] Name: ${p.name}`);
        }
    });
}

fullCheck();
