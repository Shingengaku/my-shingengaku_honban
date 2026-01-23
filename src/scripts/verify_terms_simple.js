
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve('.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
}

loadEnv();

async function run() {
    console.log('--- メンバー照合ロジック確認 (直接DB) ---');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
        return;
    }
    if (!supabaseKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. テスト対象のメンバーを取得
    const { data: members, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .not('term_id', 'is', null) // term_idが存在することを確認
        .limit(1);

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    if (!members || members.length === 0) {
        console.log('テスト対象のterm_idを持つメンバーが見つかりません。移行が失敗しているかデータがありません。');
        return;
    }

    const target = members[0];
    console.log(`Target Member: Name="${target.name}", TermID=${target.term_id}`);

    // 2. ロジックのシミュレーション
    const inputName = target.name;
    // 正規化をテストするために余分なスペースを追加
    const messyInputName = `  ${target.name.split('').join(' ')}  `;
    const inputTermId = target.term_id;

    console.log(`入力シミュレーション: Name="${messyInputName}", TermID=${inputTermId}`);

    const { data: allMembers, error } = await supabase
        .from('members')
        .select('*, ranks(id, name)')
        .eq('term_id', inputTermId);

    if (error) {
        console.error('Lookup Error:', error);
    } else {
        const normalizedInput = messyInputName.replace(/\s+/g, '');
        console.log(`正規化された入力: "${normalizedInput}"`);

        const found = allMembers.find(m => m.name.replace(/\s+/g, '') === normalizedInput);

        if (found) {
            console.log('✅ 一致しました:', found.name, found.email);
        } else {
            console.error('❌ 一致しませんでした');
        }
    }
}

run();
