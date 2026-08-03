/**
 * 【データ修正】social_venue=空文字 かつ attend_social=true の矛盾レコードを修正
 * 対象: 堺正孝 ID: 47ea7731-a417-47c6-bad3-66cee9ec2cfe
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://odxnczxbtltccfrizvkb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixData() {
    console.log('=== データ修正開始 ===\n');

    // 対象: social_venue=null/空 かつ attend_social=true の全件
    const { data: targets, error: fetchErr } = await supabase
        .from('applications')
        .select('id, input_name, social_venue, attend_social')
        .eq('attend_social', true)
        .or('social_venue.is.null,social_venue.eq.');

    if (fetchErr) { console.error('取得エラー:', fetchErr); return; }

    console.log(`修正対象: ${targets.length} 件`);
    targets.forEach(r => {
        console.log(`  → ID:${r.id} / ${r.input_name} / social_venue:'${r.social_venue}'`);
    });

    if (targets.length === 0) {
        console.log('修正対象なし');
        return;
    }

    const ids = targets.map(r => r.id);

    // 修正: attend_social=false、social_venue='none' に統一
    const { error: updateErr } = await supabase
        .from('applications')
        .update({ attend_social: false, social_venue: 'none' })
        .in('id', ids);

    if (updateErr) {
        console.error('更新エラー:', updateErr);
        return;
    }

    console.log(`\n✅ ${targets.length} 件を修正しました`);
    console.log('  attend_social: true → false');
    console.log('  social_venue: 空 → none');

    // 確認
    const { data: check } = await supabase
        .from('applications')
        .select('id, input_name, social_venue, attend_social')
        .in('id', ids);

    console.log('\n--- 修正後の確認 ---');
    check?.forEach(r => {
        console.log(`  ID:${r.id} / ${r.input_name} / social_venue:'${r.social_venue}' / attend_social:${r.attend_social}`);
    });
}

fixData().catch(console.error);
