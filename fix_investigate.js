/**
 * 【詳細調査】social_venue が null/空 かつ attend_social=true のデータを確認
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://odxnczxbtltccfrizvkb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigate() {
    console.log('=== 【詳細調査】social_venue=null/空 かつ attend_social=true ===\n');

    const { data, error } = await supabase
        .from('applications')
        .select('id, input_name, input_email, social_venue, attend_social, payment_key, venue, payment_status')
        .eq('attend_social', true)
        .or('social_venue.is.null,social_venue.eq.');

    if (error) { console.error('取得エラー:', error); return; }

    console.log(`該当件数: ${data.length} 件\n`);
    data.forEach(r => {
        const socialNull = r.social_venue === null ? 'NULL' : `'${r.social_venue}'`;
        console.log(`ID:${r.id}`);
        console.log(`  氏名: ${r.input_name}`);
        console.log(`  会場: ${r.venue}`);
        console.log(`  social_venue: ${socialNull}`);
        console.log(`  attend_social: ${r.attend_social}`);
        console.log(`  payment_key: ${r.payment_key}`);
        console.log(`  status: ${r.payment_status}`);
        
        // 懇親会なしの商品かどうかを判定
        const keyLower = (r.payment_key || '').toLowerCase();
        const isNoSocial = keyLower.includes('懇親会なし') || keyLower.includes('懇親会無し') || keyLower.includes('social_none');
        if (isNoSocial) {
            console.log(`  ⚠️  商品名から「懇親会なし」が判定できる → attend_social=false に修正対象`);
        }
        console.log();
    });

    const fixTargets = data.filter(r => {
        const keyLower = (r.payment_key || '').toLowerCase();
        return keyLower.includes('懇親会なし') || keyLower.includes('懇親会無し');
    });
    console.log(`=== 修正対象(payment_keyから懇親会なし判定): ${fixTargets.length} 件 ===`);
    console.log(`=== 全体(social_venue=null かつ attend_social=true): ${data.length} 件 ===`);
}

investigate().catch(console.error);
