
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
    console.log('--- Checking Terms Table ---');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: terms, error } = await supabase
        .from('terms')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Fetch Error:', error);
    } else {
        console.log(`Total Terms: ${terms.length}`);
        terms.forEach(t => console.log(`${t.id}: ${t.name}`));
    }
}

run();
