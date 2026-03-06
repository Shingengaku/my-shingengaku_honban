
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

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
    console.log('Checking members names...');
    const { data: members, error } = await supabaseAdmin
        .from('members')
        .select('id, name, email, is_tokushin')
        .limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Members check:');
        members.forEach(m => {
            console.log(`Name: '${m.name}', Email: ${m.email}, is_tokushin: ${m.is_tokushin}`);
        });
    }
}

main().catch(console.error);
