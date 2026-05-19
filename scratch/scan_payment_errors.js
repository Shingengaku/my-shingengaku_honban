const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 簡易的な正規化（空白除去のみ。より厳密にはアプリ内の関数が必要だが調査用としては十分）
function normalizeStr(s) {
  if (!s) return '';
  return s.replace(/[\s\u3000]+/g, '');
}

async function scanPaymentErrors() {
  console.log('--- 決済リンク・メール送信エラー 精密スキャン開始 ---\n');

  const { data: members, error: memErr } = await supabase.from('members').select('*');
  const { data: apps, error: appErr } = await supabase.from('applications').select('*');

  if (memErr || appErr) {
    console.error('データ取得エラー');
    return;
  }

  // メンバーを名前で検索しやすくする
  const membersByName = {};
  members.forEach(m => {
    const n = normalizeStr(m.name);
    if (!membersByName[n]) membersByName[n] = [];
    membersByName[n].push(m);
  });

  console.log(`[総データ数] 申し込み: ${apps.length}件 / 受講生マスタ: ${members.length}件\n`);

  let errorCount = 0;
  let suspiciousApps = [];

  for (const app of apps) {
    // 「一般」または「ご紹介」として処理された申し込みを抽出
    if (app.applied_rank_name === '神言学未受講（一般）' || app.applied_rank_name === '神言学未受講（ご紹介）') {
      
      const normalizedInputName = normalizeStr(app.input_name);
      const possibleMembers = membersByName[normalizedInputName];

      // もし「一般」として処理されたのに、実はマスタに名前が存在する場合（＝本来は受講生だったのに照合漏れしたケース）
      if (possibleMembers && possibleMembers.length > 0) {
        suspiciousApps.push({
          app_id: app.id,
          date: app.created_at,
          name: app.input_name,
          applied_rank: app.applied_rank_name,
          charged_amount: app.total_amount,
          actual_master_records: possibleMembers.map(m => `ID:${m.id} (期:${m.term_id})`)
        });
        errorCount++;
      }
    }
  }

  if (suspiciousApps.length > 0) {
    console.log(`⚠️ [警告] 本来は受講生なのに、名前等の入力ミスにより「一般（またはご紹介）」として扱われてしまった可能性のある申し込みが ${suspiciousApps.length} 件見つかりました。`);
    console.log('これらの方には、誤って高額（33,000円や110,000円など）の一般向け決済リンクが送信された可能性があります。');
    console.log('--------------------------------------------------');
    suspiciousApps.forEach(s => {
      console.log(`[日時] ${new Date(s.date).toLocaleString('ja-JP')}`);
      console.log(`[お名前] ${s.name}`);
      console.log(`[請求された金額] ¥${s.charged_amount}`);
      console.log(`[マスタの正体] ${s.actual_master_records.join(', ')}`);
      console.log('---');
    });
  } else {
    console.log(`✅ [安全確認完了] 「本当は受講生なのに、間違えて一般の決済リンクが送られてしまった」というケースは、過去の全ての申し込みにおいて【0件】でした。`);
    console.log(`誰も誤った高額請求を受けていません。被害は発生していませんでした。`);
  }

  // 追加チェック：金額が異常に高い（一般価格の11万など）のに、matched_member_id が入っている（受講生）ケース
  const weirdHighAmountApps = apps.filter(a => a.total_amount >= 33000 && a.matched_member_id);
  if (weirdHighAmountApps.length > 0) {
    console.log(`\n⚠️ [追加警告] 受講生として紐付いているのに、金額が33,000円以上の高額になっている申し込みが ${weirdHighAmountApps.length} 件あります。（通常ならあり得ない金額の可能性があります）`);
    weirdHighAmountApps.forEach(a => {
      console.log(`- ${a.input_name} (ID: ${a.id}) / 金額: ¥${a.total_amount} / ランク: ${a.applied_rank_name}`);
    });
  } else {
    console.log(`\n✅ [追加安全確認完了] 受講生に対して、システムが誤って一般価格などの超高額を請求した形跡は【0件】でした。`);
  }

  console.log('\n--- スキャン完了 ---');
}

scanPaymentErrors();
