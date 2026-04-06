
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalMigration() {
    console.log('--- Final Mop-up Rank ID Migration ---');
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    let links = settings.value;
    let count = 0;

    links = links.map(p => {
        if (!p.rank_id) {
            let nid = null;
            if (p.name.includes('ご紹介')) nid = 8;
            else if (p.name.includes('一般')) nid = 7;
            else if (p.name.includes('リピート')) nid = 2;
            else if (p.name.includes('社割')) nid = 9;
            else if (p.name.includes('経営幹部')) nid = 4;
            
            if (nid) {
                count++;
                return { ...p, rank_id: nid };
            }
        }
        return p;
    });

    if (count > 0) {
        await supabase.from('app_settings').update({ value: links }).eq('key', 'payment_links');
        console.log(`Updated ${count} more products.`);
    } else {
        console.log('Zero updates needed.');
    }
}

finalMigration();
