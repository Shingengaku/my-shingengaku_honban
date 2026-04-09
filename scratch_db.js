const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
    console.log('--- Terms ---');
    const { data: terms } = await supabaseAdmin.from('terms').select('*');
    // console.log(terms);
    console.log('Terms found:', terms?.length);

    const hojinTerm = terms?.find(t => t.name.includes('法人'));
    console.log('法人コース Term:', hojinTerm);

    console.log('\n--- Members named 松本太郎 ---');
    const { data: members } = await supabaseAdmin.from('members').select('*, terms(name), ranks(name)').ilike('name', '%松本太郎%');
    console.log(members);

    console.log('\n--- Applications for 松本太郎 (latest) ---');
    const { data: apps } = await supabaseAdmin.from('applications').select('*').ilike('input_name', '%松本太郎%').order('created_at', { ascending: false }).limit(5);
    apps?.forEach(a => {
        console.log(`Date: ${a.created_at}, Rank: ${a.applied_rank_name}, Amount: ${a.total_amount}, Remarks: ${a.remarks}`);
    });

    console.log('\n--- Product Master ---');
    const { data: settings } = await supabaseAdmin.from('app_settings').select('*').eq('key', 'payment_links').single();
    const links = settings?.value || [];
    console.log('Links count:', links.length);
    
    // Find links for "一般"
    const generalLinks = links.filter(l => l.name.includes('一般'));
    console.log('General Links (first 2):', generalLinks.slice(0, 2));

    // Find links for those venues "東京・福岡"
    const tokyoFukuokaLinks = links.filter(l => l.venue_lecture === '東京・福岡');
    console.log('Tokyo/Fukuoka Links:', tokyoFukuokaLinks);
}

inspect().catch(console.error);
