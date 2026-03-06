require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: existing, error: fetchErr } = await supabase
        .from('online_options')
        .select('*')
        .eq('name', 'LIVE視聴（2会場）');

    if (fetchErr) {
        console.error('Fetch error:', fetchErr);
        return;
    }

    if (existing && existing.length > 0) {
        console.log('Already exists:', existing);
        return;
    }

    const { data, error } = await supabase
        .from('online_options')
        .insert({ name: 'LIVE視聴（2会場）', type: 'online', sort_order: 10 })
        .select();

    if (error) {
        console.error('Error inserting:', error);
    } else {
        console.log('Inserted successfully:', data);
    }
}
run();
