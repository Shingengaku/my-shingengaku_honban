
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// サーバーが実行中の場合のローカルテスト用のモックフェッチ
async function run() {
    console.log('--- Terms APIを確認中 ---');
    try {
        const termsRes = await fetch('http://localhost:3000/api/terms');
        if (termsRes.ok) {
            const terms = await termsRes.json();
            console.log(`Terms取得成功: ${terms.length} 件`);
            console.log('Termsサンプル:', terms[0]);
        } else {
            console.error('Termsの取得に失敗しました:', termsRes.status);
        }
    } catch (e) {
        console.error('Termsの取得エラー (サーバーは起動していますか?):', (e as Error).message);
    }

    // 申込ロジックテストには実際のマッチングが必要です。
    // 実際のデータを送信したり副作用（メール送信）のリスクを冒さずにApply APIを簡単にテストすることはできません。
    // そのため、ここではSupabase Adminを直接使用してロジックをシミュレーションします。

    console.log('\n--- メンバー照合ロジック確認 (直接DB) ---');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // テストケース: 名前 "神言 太郎" (正規化後 "神言太郎") と期 "1期" (ID 1)
    // まず、そのようなメンバーが存在するか確認します。
    const { data: members } = await supabase.from('members').select('*').limit(1);
    if (!members || members.length === 0) {
        console.log('テスト対象のメンバーが見つかりません。');
        return;
    }
    const target = members[0];
    console.log('対象メンバー:', target.name, 'Term ID:', target.term_id);

    // 検索をシミュレーション
    const inputName = target.name; // "神言 太郎" と仮定
    const inputTermId = target.term_id;

    const { data: allMembers, error } = await supabase
        .from('members')
        .select('*, ranks(id, name)')
        .eq('term_id', inputTermId);

    if (error) {
        console.error('Lookup Error:', error);
    } else {
        const normalizedInput = inputName.replace(/\s+/g, '');
        const found = allMembers.find((m: any) => m.name.replace(/\s+/g, '') === normalizedInput);

        if (found) {
            console.log('✅ Match Found:', found.name, found.email);
        } else {
            console.error('❌ Match Failed for:', inputName);
        }
    }
}

run();
