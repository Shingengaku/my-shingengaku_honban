
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    console.log("Checking RLS status for tables in public schema...");
    
    // We can use RPC to run arbitrary query if we create one, 
    // but here we might try to guess table names or use what we know.
    // A better way is to query pg_class via a custom function if enabled.
    // Since we don't know if such function exists, let's try to query information_schema.tables first
    // though that doesn't show RLS status.
    
    const tablesToCheck = [
        'applications',
        'app_settings',
        'admin_users',
        'members',
        'venues',
        'ranks',
        'terms',
        'online_options'
    ];

    // Let's also look for any other tables by trying to query information_schema if possible
    // Actually, we can just use the SQL interface if we were on the dashboard.
    // From JS, we can try to find what tables are available.
    
    // Try to get all table names first (this might fail if the API doesn't expose it)
    const { data: tableData, error: tableError } = await supabase
        .from('pg_tables') // This won't work directly via PostgREST unless exposed
        .select('tablename')
        .eq('schemaname', 'public');

    if (tableError) {
        console.log("Cannot query pg_tables directly. Trying another way...");
    } else {
        console.log("Tables found:", tableData.map(t => t.tablename));
    }

    // Since I can't easily query pg_class via JS client without a custom RPC,
    // I will try to fetch with ANON key to see what's public.
}

async function testWithAnonKey() {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    const tablesToCheck = [
        'applications',
        'app_settings',
        'admin_users',
        'members',
        'venues',
        'ranks',
        'terms',
        'online_options'
    ];

    console.log("\nTesting access with ANON key:");
    for (const table of tablesToCheck) {
        const { data, error } = await anonSupabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`[SAFE] ${table}: ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`[DANGER] ${table}: Accessible! Data count: ${data.length}`);
        }
    }
}

testWithAnonKey();
