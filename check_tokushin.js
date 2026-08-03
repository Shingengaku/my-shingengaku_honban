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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log('--- 4期生 & 特進メンバーの確認 ---');
    const { data: members, error: mError } = await supabaseAdmin
        .from('members')
        .select('id, name, email, is_tokushin, term_id')
        .eq('is_tokushin', true)
        .eq('term_id', 4);

    if (mError) {
        console.error('Members Error:', mError);
        return;
    }

    console.log(`該当メンバー数: ${members.length}`);
    for (const m of members) {
        console.log(`ID: ${m.id}, Name: '${m.name}', Email: '${m.email}', term_id: ${m.term_id}, is_tokushin: ${m.is_tokushin}`);
        
        // このメンバーに関連する申込を検索
        const { data: apps, error: aError } = await supabaseAdmin
            .from('applications')
            .select('id, input_name, input_email, matched_member_id, venue, payment_status, tags, applied_rank_name')
            .or(`matched_member_id.eq.${m.id},input_email.eq.${m.email},input_name.eq.${m.name}`);
        
        if (aError) {
            console.error('Apps Error:', aError);
            continue;
        }

        console.log(`  関連申込数: ${apps.length}`);
        for (const app of apps) {
            console.log(`    AppID: ${app.id}, Name: '${app.input_name}', Email: '${app.input_email}', matched_member_id: ${app.matched_member_id}, venue: '${app.venue}', payment_status: '${app.payment_status}', applied_rank_name: '${app.applied_rank_name}', tags: ${JSON.stringify(app.tags)}`);
        }
    }
}

main().catch(console.error);
