
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
    console.log("Fetching all tables in 'public' schema...");
    
    // In Supabase, we can use the 'rpc' to run a query if we have a helper, 
    // but usually we can't query information_schema directly via .from() unless it's exposed.
    // However, we can try to guess or use the SQL Editor if we had it.
    
    // Let's try to query a known table to see if we can get anything about other tables.
    // Actually, I'll use a trick: query a non-existent table and see the error message? No.
    
    // I will try to fetch the list of tables by querying the 'pg_tables' if it's available via REST
    const { data, error } = await supabase
        .from('pg_catalog.pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

    if (error) {
        console.log("Could not query pg_catalog.pg_tables directly. Error:", error.message);
        
        // Try information_schema
        const { data: data2, error: error2 } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');
            
        if (error2) {
            console.log("Could not query information_schema.tables. Error:", error2.message);
            console.log("Falling back to manual list from codebase.");
            return [
                'applications',
                'app_settings',
                'admin_users',
                'venues',
                'ranks',
                'members',
                'online_options',
                'terms'
            ];
        } else {
            return data2.map(t => t.table_name);
        }
    } else {
        return data.map(t => t.tablename);
    }
}

async function main() {
    const tables = await listAllTables();
    console.log("Detected tables:", tables);
    
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    console.log("\nRLS Audit (checking if ANON can see rows):");
    for (const table of tables) {
        const { data, error } = await anonSupabase.from(table).select('*').limit(1);
        if (error) {
            if (error.code === '42501' || error.message.includes('permission denied')) {
                console.log(`[PASS] ${table}: Permission denied (RLS likely active)`);
            } else {
                console.log(`[CHECK] ${table}: Error ${error.code} - ${error.message}`);
            }
        } else {
            console.log(`[FAIL] ${table}: Accessible via ANON key!`);
            if (data.length > 0) {
                console.log(`       Sample columns found: ${Object.keys(data[0]).join(', ')}`);
            }
        }
    }
}

main();
