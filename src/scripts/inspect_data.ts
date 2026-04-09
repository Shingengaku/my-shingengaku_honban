import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspect() {
    console.log('--- Terms ---');
    const { data: terms } = await supabaseAdmin.from('terms').select('*');
    console.log(terms);

    console.log('\n--- Members named 松本太郎 ---');
    const { data: members } = await supabaseAdmin.from('members').select('*, terms(name), ranks(name)').ilike('name', '%松本%太郎%');
    console.log(members);

    console.log('\n--- Applications for 松本太郎 ---');
    const { data: apps } = await supabaseAdmin.from('applications').select('*').ilike('input_name', '%松本%太郎%').order('created_at', { ascending: false });
    console.log(apps);

    console.log('\n--- Product Master (Payment Links) ---');
    const { data: settings } = await supabaseAdmin.from('app_settings').select('*').eq('key', 'payment_links').single();
    console.log(JSON.stringify(settings?.value, null, 2));
}

inspect().catch(console.error);
