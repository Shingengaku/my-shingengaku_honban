
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    console.log('--- Checking Terms ---');
    const { data: terms } = await supabase.from('terms').select('id, name');
    console.log(terms);

    console.log('--- Checking Member "福家" ---');
    const { data: members } = await supabase
        .from('members')
        .select('id, name, email, term_id, is_tokushin')
        .ilike('name', '%福家%');

    console.log(members);
}

checkData();
