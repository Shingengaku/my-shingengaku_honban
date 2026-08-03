
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) {
            console.error('Env file not found at:', envPath);
            return;
        }
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Failed to load env:', e);
    }
}

loadEnv();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    console.log('--- Searching in members ---');
    const { data: members, error: mError } = await supabaseAdmin
        .from('members')
        .select('*, ranks(id, name)')
        .ilike('name', '%酒井%');

    if (mError) {
        console.error('Members query error:', mError);
    } else {
        console.log(`Found ${members.length} members:`, JSON.stringify(members, null, 2));
    }

    console.log('\n--- Searching in applications ---');
    const { data: apps, error: aError } = await supabaseAdmin
        .from('applications')
        .select('*')
        .ilike('input_name', '%酒井%');

    if (aError) {
        console.error('Applications query error:', aError);
    } else {
        console.log(`Found ${apps.length} applications:`, JSON.stringify(apps, null, 2));
    }
}

main().catch(console.error);
