
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    console.log('--- Terms Table ---');
    const { data: terms, error: ternsError } = await supabaseAdmin
        .from('terms')
        .select('*')
        .limit(5);

    if (ternsError) console.error(ternsError);
    else {
        if (terms.length > 0) {
            console.log('Sample Row:', terms[0]);
            console.log('Keys:', Object.keys(terms[0]));
        } else {
            console.log('Table is empty');
        }
    }

    console.log('\n--- Members Table Link ---');
    const { data: members, error: membersError } = await supabaseAdmin
        .from('members')
        .select('id, name, term_id')
        .limit(1);

    if (membersError) console.error(membersError);
    else {
        if (members.length > 0) {
            console.log('Sample Row:', members[0]);
        } else {
            console.log('Table is empty');
        }
    }
}

main().catch(console.error);
