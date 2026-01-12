
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

    async function checkTable(tableName) {
        console.log(`\n### Table: ${tableName}`);
        const { data, error } = await supabase.from(tableName).select('*').limit(1);
        if (error) {
            console.log(`Error: ${error.message}`);
        } else if (data && data.length > 0) {
            console.log('Columns and sample types:');
            const row = data[0];
            Object.keys(row).forEach(key => {
                const val = row[key];
                const type = Array.isArray(val) ? 'Array' : (row[key] === null ? 'null' : typeof row[key]);
                console.log(`- ${key}: ${type} (Example: ${JSON.stringify(val)})`);
            });
        } else {
            console.log('Table exists but is empty. Cannot infer columns from data.');
            // Try to insert a dummy to get error? No, too risky.
        }
    }

    await checkTable('applications');
    await checkTable('members');
    await checkTable('admin_users');
    await checkTable('ranks');
    await checkTable('terms');
    await checkTable('venues');
}

run();
