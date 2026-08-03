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
    console.log('--- 特進メンバーの全確認 ---');
    const { data: members, error: mError } = await supabaseAdmin
        .from('members')
        .select(`
            id, 
            name, 
            email, 
            is_tokushin, 
            term_id,
            terms ( name )
        `)
        .eq('is_tokushin', true);

    if (mError) {
        console.error('Members Error:', mError);
        return;
    }

    console.log(`特進メンバー数: ${members.length}`);
    for (const m of members) {
        // このメンバーに関連する申込を検索
        const { data: apps, error: aError } = await supabaseAdmin
            .from('applications')
            .select('id, input_name, input_email, matched_member_id, venue, payment_status, tags, applied_rank_name')
            .or(`matched_member_id.eq.${m.id},input_email.eq.${m.email},input_name.eq.${m.name}`);
        
        if (aError) {
            console.error('Apps Error:', aError);
            continue;
        }

        const matchedApp = apps.find(app => app.matched_member_id === m.id);
        const termName = m.terms?.name || '期なし';
        
        console.log(`Name: '${m.name}' (${termName}), Email: '${m.email}'`);
        console.log(`  matched_member_id結合アプリ: ${matchedApp ? 'あり' : 'なし'}`);
        for (const app of apps) {
            console.log(`    AppID: ${app.id}, InputName: '${app.input_name}', Email: '${app.input_email}', matched: ${app.matched_member_id}, rank: '${app.applied_rank_name}'`);
        }
    }
}

main().catch(console.error);
