const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '..', '.env.local');
        if (!fs.existsSync(envPath)) return;

        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Failed to load env:', e);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log('Searching for applications with email gen.nakamura138@gmail.com...');
    const { data: apps, error } = await supabaseAdmin
        .from('applications')
        .select('*')
        .eq('input_email', 'gen.nakamura138@gmail.com');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${apps.length} applications.`);
        apps.forEach((app, idx) => {
            console.log(`\n--- Application ${idx + 1} ---`);
            console.log(`ID: ${app.id}`);
            console.log(`Name: ${app.input_name}`);
            console.log(`Remarks: ${JSON.stringify(app.remarks)}`);
            console.log(`Tags: ${JSON.stringify(app.tags)}`);
            console.log(`Applied Rank Name: ${app.applied_rank_name}`);
            console.log(`Total Amount: ${app.total_amount}`);
        });
    }
}

main().catch(console.error);
