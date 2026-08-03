
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
    console.log('--- Simulating API `/api/admin/applications` ---');
    const { data, error } = await supabaseAdmin
        .from('applications')
        .select(`
          *,
          members (
            terms ( name ),
            generation,
            furigana,
            is_tokushin,
            ranks (
              id,
              name,
              base_fee,
              sort_order
            )
          )
        `);

    if (error) {
        console.error(error);
        return;
    }

    const target = data.find(app => app.input_name.includes('坂井'));
    if (!target) {
        console.log('Target not found');
        return;
    }

    console.log('Raw target application:', JSON.stringify(target, null, 2));

    const generation = parseInt(target.members?.terms?.name || target.members?.generation || '0');
    console.log('Parsed generation:', generation);

    const members = target.members ? { ...target.members, generation } : null;
    console.log('Final members field:', JSON.stringify(members, null, 2));
}

main().catch(console.error);
