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

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    // 茅根則彦様のapplicationsを確認
    const { data: apps } = await supabaseAdmin
        .from('applications')
        .select('*, members(*, ranks(*))')
        .ilike('input_name', '%茅根%');
    console.log('--- Applications for 茅根 ---');
    console.log(JSON.stringify(apps, null, 2));

    // membersを確認
    const { data: members } = await supabaseAdmin
        .from('members')
        .select('*, terms(name)')
        .ilike('name', '%茅根%');
    console.log('--- Members for 茅根 ---');
    console.log(JSON.stringify(members, null, 2));

    // termsを確認
    const { data: terms } = await supabaseAdmin
        .from('terms')
        .select('*');
    console.log('--- Terms ---');
    console.log(JSON.stringify(terms, null, 2));
}

main().catch(console.error);
