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

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizeName(name, customMapStr) {
    if (!name) return '';
    let normalized = name.replace(/[\s\u3000]+/g, '');
    if (customMapStr) {
        try {
            const mapLines = customMapStr.split('\n');
            mapLines.forEach(line => {
                const [from, to] = line.split(/[=＝]/).map(s => s.trim());
                if (from && to) {
                    normalized = normalized.split(from).join(to);
                }
            });
        } catch (e) {}
    }
    return normalized;
}

async function main() {
    const dryRun = process.argv.includes('--run') ? false : true;
    console.log(`--- 未紐付け申込データの一括修復 ---`);
    console.log(`モード: ${dryRun ? 'DRY RUN (更新しません)' : '実行 (更新します)'}`);
    
    // 1. 漢字マッピング取得
    const { data: kanjiSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'kanji_mapping')
        .single();
    const customKanjiMap = kanjiSetting?.value || '';

    // 2. メンバーマスタ取得
    const { data: members, error: mError } = await supabaseAdmin
        .from('members')
        .select('id, name, furigana, terms(name), is_tokushin');
    
    if (mError) throw mError;
    
    // メンバーの正規化名を準備
    const membersWithNorm = members.map(m => ({
        ...m,
        normName: normalizeName(m.name, customKanjiMap),
        normFuri: normalizeName(m.furigana, customKanjiMap)
    }));

    // 3. 未紐付け申込の取得
    const { data: apps, error: aError } = await supabaseAdmin
        .from('applications')
        .select('id, input_name, input_furigana, applied_rank_name')
        .is('matched_member_id', null)
        .neq('payment_status', 'cancelled');
        
    if (aError) throw aError;

    let matchCount = 0;
    
    for (const app of apps) {
        // "神言学未受講" などは対象外
        if (app.applied_rank_name && app.applied_rank_name.includes('未受講')) {
            continue;
        }

        const normInputName = normalizeName(app.input_name, customKanjiMap);
        const normInputFuri = normalizeName(app.input_furigana, customKanjiMap);
        
        // 候補を探す
        const candidates = membersWithNorm.filter(m => {
            const nameMatch = m.normName === normInputName;
            const furiMatch = m.normFuri && normInputFuri && m.normFuri === normInputFuri;
            return nameMatch || furiMatch;
        });

        if (candidates.length === 1) {
            const target = candidates[0];
            console.log(`[MATCH] 申込: ${app.input_name} -> メンバー: ${target.name} (ID:${target.id}, ${target.terms?.name || '期なし'}${target.is_tokushin ? ' 特進' : ''})`);
            matchCount++;
            
            if (!dryRun) {
                const { error: updateError } = await supabaseAdmin
                    .from('applications')
                    .update({ matched_member_id: target.id })
                    .eq('id', app.id);
                if (updateError) {
                    console.error(`  -> UPDATE ERROR: ${updateError.message}`);
                } else {
                    console.log(`  -> SUCCESS`);
                }
            }
        } else if (candidates.length > 1) {
            console.log(`[SKIP] 申込: ${app.input_name} -> 候補が複数あります (${candidates.length}件)`);
        }
    }
    
    console.log(`\nマッチした件数: ${matchCount}件`);
    if (dryRun) {
        console.log(`実際の更新を行うには、 node fix_unmatched_apps.js --run を実行してください。`);
    }
}

main().catch(console.error);
