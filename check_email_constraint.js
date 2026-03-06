
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNullEmail() {
    console.log('--- Trying Insert with Null Email ---');
    const { data, error } = await supabase
        .from('members')
        .insert({
            name: 'Test Null Email',
            furigana: 'test',
            rank_id: 1,
            term_id: 1,
            is_tokushin: false
            // email omitted
        })
        .select();

    if (error) {
        console.log('Insert failed:', error.message);
    } else {
        console.log('Insert success:', data);
        // Clean up
        await supabase.from('members').delete().eq('id', data[0].id);
    }
}

checkNullEmail();
