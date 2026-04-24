
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function verify() {
    console.log("Verifying security for 'online_options' table...");
    
    // 1. Check with admin key (should have data)
    const { data: adminData } = await adminClient.from('online_options').select('*');
    console.log(`Admin access: Found ${adminData ? adminData.length : 0} rows.`);
    
    // 2. Check with anon key (should have 0 rows if RLS is working)
    const { data: anonData, error: anonError } = await anonClient.from('online_options').select('*');
    if (anonError) {
        console.log(`Anon access error: ${anonError.message}`);
        console.log("SUCCESS: Access blocked by error.");
    } else if (anonData && anonData.length === 0) {
        console.log("Anon access: Found 0 rows.");
        console.log("SUCCESS: Access blocked by RLS (0 rows returned).");
    } else {
        console.log(`Anon access: Found ${anonData ? anonData.length : 0} rows.`);
        console.log("DANGER: Access still possible!");
    }
}

verify();
