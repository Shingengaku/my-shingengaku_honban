/**
 * 【ドライラン】attend_social と social_venue の矛盾データ確認スクリプト
 * このスクリプトはデータを変更しません。件数と内容を表示するだけです。
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://odxnczxbtltccfrizvkb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function dryRun() {
    console.log('=== 【ドライラン】矛盾データ確認 ===\n');

    // ケース1: social_venue='none' かつ attend_social=true
    const { data: case1, error: err1 } = await supabase
        .from('applications')
        .select('id, input_name, input_email, social_venue, attend_social, payment_status')
        .eq('social_venue', 'none')
        .eq('attend_social', true);

    if (err1) { console.error('ケース1取得エラー:', err1); return; }

    console.log(`▼ ケース1: social_venue='none' かつ attend_social=true`);
    console.log(`  → 件数: ${case1.length} 件`);
    if (case1.length > 0) {
        case1.forEach(r => {
            console.log(`  ID:${r.id} / ${r.input_name} / ${r.input_email} / status:${r.payment_status}`);
        });
    }
    console.log();

    // ケース2: social_venue='参加しない' かつ attend_social=true
    const { data: case2, error: err2 } = await supabase
        .from('applications')
        .select('id, input_name, input_email, social_venue, attend_social, payment_status')
        .eq('social_venue', '参加しない')
        .eq('attend_social', true);

    if (err2) { console.error('ケース2取得エラー:', err2); return; }

    console.log(`▼ ケース2: social_venue='参加しない' かつ attend_social=true`);
    console.log(`  → 件数: ${case2.length} 件`);
    if (case2.length > 0) {
        case2.forEach(r => {
            console.log(`  ID:${r.id} / ${r.input_name} / ${r.input_email} / status:${r.payment_status}`);
        });
    }
    console.log();

    // ケース3: social_venue='ー' かつ attend_social=true
    const { data: case3, error: err3 } = await supabase
        .from('applications')
        .select('id, input_name, input_email, social_venue, attend_social, payment_status')
        .eq('social_venue', 'ー')
        .eq('attend_social', true);

    if (err3) { console.error('ケース3取得エラー:', err3); return; }

    console.log(`▼ ケース3: social_venue='ー' かつ attend_social=true`);
    console.log(`  → 件数: ${case3.length} 件`);
    if (case3.length > 0) {
        case3.forEach(r => {
            console.log(`  ID:${r.id} / ${r.input_name} / ${r.input_email} / status:${r.payment_status}`);
        });
    }
    console.log();

    const total = case1.length + case2.length + case3.length;
    console.log(`=== 合計 ${total} 件の矛盾データが見つかりました ===`);
    if (total > 0) {
        console.log('→ fix_attend_social.js を実行すると修正できます');
    } else {
        console.log('→ 矛盾データはありません。修正不要です！');
    }
}

dryRun().catch(console.error);
