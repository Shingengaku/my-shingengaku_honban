
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// .env.local を読み込む
const envPath = path.resolve(process.cwd(), '.env.local');
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
            if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = value;
        }
    });
} catch (e) {
    console.error('Failed to load .env.local', e);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log('Fetching latest app...');
    const { data: app, error } = await supabase
        .from('applications')
        .select('*, members(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.log('Error fetching app:', error);
        return;
    }
    if (!app) {
        console.log('No apps found');
        return;
    }

    console.log('--- DATA START ---');
    console.log('ID:' + app.id);
    console.log('CC:' + app.cc_email);
    console.log('BCC:' + app.bcc_email);
    console.log('Gen:' + app.members?.generation);
    console.log('MID:' + app.matched_member_id);
    console.log('Keys:', Object.keys(app));
    console.log('--- DATA END ---');
}

main();
