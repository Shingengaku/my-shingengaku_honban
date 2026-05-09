const { Client } = require('pg');
require('dotenv').config({path: '.env.local'});
const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:' + process.env.SUPABASE_SERVICE_ROLE_KEY + '@').replace('.supabase.co', '.supabase.co:5432/postgres')
});

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT tc.table_name, kcu.column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
        WHERE ccu.table_name = 'members';
    `);
    console.log(res.rows);
    await client.end();
}
run().catch(console.error);
