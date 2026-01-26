
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve('.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
}

loadEnv();

async function run() {
    console.log('--- Inspecting Table Structures ---');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper to get one row to infer structure
    async function checkTable(tableName) {
        console.log(`\nChecking table: ${tableName}`);
        const { data, error } = await supabase.from(tableName).select('*').limit(1);
        if (error) {
            console.log(`Error or table not found: ${error.message}`);
        } else if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]).join(', '));
            console.log('Sample Row:', data[0]);
        } else {
            console.log('Table exists but is empty or no columns returned');
        }
    }

    const args = process.argv.slice(2);
    const tablesToCheck = args.length > 0 ? args : ['ranks', 'venues', 'products', 'terms', 'applications'];

    for (const table of tablesToCheck) {
        await checkTable(table);
    }
}

run();
