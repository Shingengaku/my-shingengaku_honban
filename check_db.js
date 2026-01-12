
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// 簡易的な .env.local パーサー
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) return;

        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // クォート削除
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
    console.log('URL:', supabaseUrl);
    // Keyは見せない
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log('Checking members names...');
    const { data: members, error } = await supabaseAdmin
        .from('members')
        .select('id, name, email')
        .limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Members check:');
        members.forEach(m => {
            console.log(`Name: '${m.name}', Email: ${m.email}, hasSpace: ${m.name.includes(' ') || m.name.includes('　')}`);
        });
    }
}

main().catch(console.error);
