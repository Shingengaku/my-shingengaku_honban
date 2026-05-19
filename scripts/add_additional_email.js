// Supabase REST API を使って直接SQLを実行する
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
    // Supabase の pg meta API を直接呼ぶ
    // ref: https://supabase.com/docs/guides/database/extensions
    
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    console.log('Project ref:', projectRef);
    
    // Method 1: Use the Supabase PostgREST directly with raw SQL via pg functions
    // Actually, let's try using the supabase-js query builder approach
    // We can add the column by trying to insert/update with it and handling the error
    
    // Method 2: Use direct postgres connection if available
    // Method 3: Use the REST API /rest/v1/rpc endpoint
    
    const sql = 'ALTER TABLE applications ADD COLUMN IF NOT EXISTS additional_email text;';
    
    // Try calling the SQL endpoint directly
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ sql })
    });
    
    if (resp.ok) {
        console.log('✅ Column added successfully via exec_sql RPC!');
        return;
    }
    
    console.log('exec_sql RPC not available (status:', resp.status, ')');
    console.log('Trying alternative approach...');
    
    // Alternative: Use pg_net or direct connection
    // Try the SQL API endpoint (Supabase v2)
    const sqlResp = await fetch(`${supabaseUrl}/pg/sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query: sql })
    });
    
    if (sqlResp.ok) {
        console.log('✅ Column added successfully via pg/sql!');
        return;
    }
    
    console.log('pg/sql not available (status:', sqlResp.status, ')');
    
    // Final fallback: Check if the DATABASE_URL env var is available for direct pg connection
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        console.log('DATABASE_URL found, trying direct pg connection...');
        try {
            const { Client } = require('pg');
            const client = new Client({ connectionString: dbUrl });
            await client.connect();
            await client.query(sql);
            await client.end();
            console.log('✅ Column added successfully via direct pg!');
            return;
        } catch (e) {
            console.error('Direct pg failed:', e.message);
        }
    }
    
    console.log('');
    console.log('⚠️  Automatic migration not possible. Please run manually in Supabase SQL Editor:');
    console.log('');
    console.log('  ALTER TABLE applications ADD COLUMN IF NOT EXISTS additional_email text;');
    console.log('');
    console.log('Note: The application code has been designed to gracefully handle the missing column.');
    console.log('The resend feature will work for sending emails, but the additional_email will not be');
    console.log('persisted until the column is created.');
}

main().catch(console.error);
