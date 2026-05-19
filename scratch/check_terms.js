
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    console.log(`Fetching all terms...`);
    
    const { data: terms, error } = await supabaseAdmin
        .from('terms')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Terms:');
        console.log(JSON.stringify(terms, null, 2));
    }
}

main().catch(console.error);
