
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    const email = 'suraimu.358@icloud.com';
    console.log(`Searching for members with email: ${email}...`);
    
    const { data: members, error } = await supabaseAdmin
        .from('members')
        .select(`
            *,
            ranks(name),
            terms(name)
        `)
        .eq('email', email);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Results:');
        console.log(JSON.stringify(members, null, 2));
    }
}

main().catch(console.error);
