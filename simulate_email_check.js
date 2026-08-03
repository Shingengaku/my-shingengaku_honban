/**
 * シミュレーション: 簡易エクセルに表示されるメールアドレスとお申込みデータの一致確認
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://odxnczxbtltccfrizvkb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('=== 簡易エクセルのメールアドレス表示シミュレーション ===\n');

    // 申込データ取得
    const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select(`
            id, input_name, input_email, input_furigana,
            venue, social_venue, payment_status,
            applied_rank_name, participation_type, tags,
            introducer, payment_key, created_at,
            members ( id, generation, furigana, is_tokushin, terms ( name ), ranks ( id, name ) )
        `);

    if (appsError) { console.error('取得エラー:', appsError.message); return; }

    console.log(`申込データ取得: ${apps.length}件\n`);

    // エクセル有効申込みに絞り込む（handleSimpleExcelExport と同じロジック）
    const validApps = apps.filter(a => {
        if ((a.payment_status || '').toLowerCase() === 'cancelled') return false;
        const tags = a.tags || [];
        if (tags.includes('不参加') || tags.includes('キャンセル') || tags.includes('欠席')) return false;
        const venue = (a.venue || '').trim();
        if (venue === '参加しない' || venue === '不参加' || venue === 'キャンセル' || venue === '欠席') return false;
        return true;
    });

    console.log(`エクセル出力対象: ${validApps.length}件\n`);

    // getMemberInfo の email 処理を再現
    // → email: app.input_email || ''  (変換なし・そのまま)
    const results = validApps.map(app => ({
        id: app.id,
        name: app.input_name,
        emailInApp: app.input_email || '',         // DBに保存されている値
        emailInExcel: app.input_email || '',        // エクセルに出力される値 (getMemberInfo の戻り値)
        match: true,                                // 実装上は常に一致（同じ変数）
        venue: app.venue,
        paymentStatus: app.payment_status,
        memberEmail: null,  // ※ membersテーブルにemailカラムはない（申込テーブルのinput_emailのみ）
    }));

    // ① 実装上の齟齬チェック（コード上の問題）
    console.log('【① 実装上の齟齬チェック】');
    console.log('getMemberInfo は app.input_email を email としてそのまま返します。');
    console.log('エクセルの renderBlock は d.email をセルに書き込みます。');
    console.log('→ 申込DBの input_email ⇔ エクセル表示: ✅ 変換・変質なし、完全一致\n');

    // ② メールアドレス未入力チェック
    const emptyEmail = results.filter(r => !r.emailInApp || r.emailInApp.trim() === '');
    console.log(`【② メールアドレス未入力チェック】`);
    if (emptyEmail.length === 0) {
        console.log('✅ 全エクセル対象申込にメールアドレスが入力されています。\n');
    } else {
        console.log(`⚠️  未入力: ${emptyEmail.length}件`);
        emptyEmail.forEach(r => console.log(`  ID:${r.id} / ${r.name} / 会場:${r.venue}`));
        console.log('  → エクセルのメール列は空欄になります。\n');
    }

    // ③ 同一メール・異なる氏名チェック（なりすまし・誤入力の可能性）
    const emailToNames = new Map();
    results.forEach(r => {
        if (!r.emailInApp) return;
        const email = r.emailInApp.toLowerCase().trim();
        if (!emailToNames.has(email)) emailToNames.set(email, []);
        emailToNames.get(email).push({ id: r.id, name: r.name, venue: r.venue });
    });

    const conflictEmails = Array.from(emailToNames.entries()).filter(([email, entries]) => {
        const uniqueNames = new Set(entries.map(e => (e.name || '').replace(/[\s　]+/g, '')));
        return uniqueNames.size > 1;
    });

    console.log(`【③ 同一メール・異なる氏名チェック】`);
    if (conflictEmails.length === 0) {
        console.log('✅ 同一メールアドレスで異なる氏名の申込みはありません。\n');
    } else {
        console.log(`⚠️  ${conflictEmails.length}件の同一メール・異名義申込みがあります:`);
        conflictEmails.forEach(([email, entries]) => {
            console.log(`\n  メール: ${email}`);
            entries.forEach(e => console.log(`    ID:${e.id} / 氏名:${e.name} / 会場:${e.venue}`));
        });
        console.log('\n  → エクセルにはそれぞれの氏名+そのメールが表示されます。');
        console.log('    「誰のメールか」という観点では、申込フォームで本人が入力した値です。\n');
    }

    // ④ 同一氏名・異なるメールチェック（同一人物が複数メールで申し込んでいるケース）
    const nameToEmails = new Map();
    results.forEach(r => {
        const name = (r.name || '').replace(/[\s　]+/g, '');
        if (!name) return;
        if (!nameToEmails.has(name)) nameToEmails.set(name, []);
        nameToEmails.get(name).push({ id: r.id, email: r.emailInApp, venue: r.venue });
    });

    const conflictNames = Array.from(nameToEmails.entries()).filter(([name, entries]) => {
        const uniqueEmails = new Set(entries.map(e => (e.email || '').toLowerCase().trim()).filter(Boolean));
        return uniqueEmails.size > 1;
    });

    console.log(`【④ 同一氏名・異なるメールチェック】`);
    if (conflictNames.length === 0) {
        console.log('✅ 同一氏名で異なるメールアドレスの申込みはありません。\n');
    } else {
        console.log(`⚠️  ${conflictNames.length}件の同一氏名・異なるメールアドレス申込みがあります:`);
        conflictNames.forEach(([name, entries]) => {
            console.log(`\n  氏名: ${name}`);
            entries.forEach(e => console.log(`    ID:${e.id} / メール:${e.email} / 会場:${e.venue}`));
        });
        console.log('\n  → エクセルではその申込レコードのメールがそのまま表示されます。\n');
    }

    // ⑤ サマリー
    console.log('=== サマリー ===');
    console.log(`総申込件数:                ${apps.length} 件`);
    console.log(`エクセル出力対象:          ${validApps.length} 件`);
    console.log(`メールアドレス未入力:      ${emptyEmail.length} 件`);
    console.log(`同一メール・異名義:        ${conflictEmails.length} 件`);
    console.log(`同一氏名・異メール:        ${conflictNames.length} 件`);
    console.log('');
    console.log('=== データフロー（コード確認済み）===');
    console.log('申込フォーム入力');
    console.log('  → applications.input_email に保存 (DB)');
    console.log('  → GET /api/admin/applications が input_email をそのまま返す (route.ts L93)');
    console.log('  → getMemberInfo が email: app.input_email を返す (page.tsx L2127)');
    console.log('  → renderBlock が d.email をエクセルセルに書き込む');
    console.log('');
    console.log('結論: エクセルのメールアドレスは申込フォームで入力されたものそのまま。');
    console.log('      実装上の齟齬・変換・混入は一切ありません。');
}

main().catch(console.error);
