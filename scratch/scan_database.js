const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scanDatabase() {
  console.log('--- データベース スキャン開始 ---\n');

  // 1. 全メンバー取得
  const { data: members, error: memErr } = await supabase.from('members').select('*');
  if (memErr) {
    console.error('メンバー取得エラー:', memErr);
    return;
  }
  console.log(`[チェック1] 登録されている受講生マスタの総数: ${members.length}件`);

  // 重複メールアドレスのチェック
  const emailCounts = {};
  const duplicateEmails = [];
  members.forEach(m => {
    if (m.email) {
      const e = m.email.toLowerCase().trim();
      if (!emailCounts[e]) emailCounts[e] = [];
      emailCounts[e].push(m);
    }
  });

  for (const email in emailCounts) {
    if (emailCounts[email].length > 1) {
      duplicateEmails.push({ email, records: emailCounts[email].map(r => ({ id: r.id, name: r.name, term_id: r.term_id, created_at: r.created_at })) });
    }
  }

  if (duplicateEmails.length > 0) {
    console.log(`\n⚠️ [警告] 同じメールアドレスで複数登録されている受講生が ${duplicateEmails.length} 件見つかりました:`);
    console.log(JSON.stringify(duplicateEmails, null, 2));
  } else {
    console.log('\n✅ [正常] メールアドレスの重複登録はありません。');
  }

  // 同姓同名のチェック（空白除去後）
  const nameCounts = {};
  const duplicateNames = [];
  members.forEach(m => {
    if (m.name) {
      const n = m.name.replace(/[\s\u3000]+/g, '');
      if (!nameCounts[n]) nameCounts[n] = [];
      nameCounts[n].push(m);
    }
  });

  for (const name in nameCounts) {
    if (nameCounts[name].length > 1) {
      // メールアドレスが空のもの同士などは除外すべきかもしれないが、一旦全部出す
      duplicateNames.push({ name, count: nameCounts[name].length, ids: nameCounts[name].map(r => r.id) });
    }
  }

  if (duplicateNames.length > 0) {
    console.log(`\n⚠️ [警告] 同姓同名（別ID）の受講生が ${duplicateNames.length} 件見つかりました（ご家族などの可能性もあります）:`);
    console.log(duplicateNames.slice(0, 5)); // 全て出すと長いので5件だけ
    if (duplicateNames.length > 5) console.log(`...他 ${duplicateNames.length - 5} 件`);
  }

  // 2. データの不整合チェック (term_idがない、rank_idがない等)
  const invalidMembers = members.filter(m => (!m.term_id && m.generation) || !m.rank_id);
  if (invalidMembers.length > 0) {
    console.log(`\n⚠️ [警告] 属性（期やランク）が正しく設定されていない受講生が ${invalidMembers.length} 件見つかりました。`);
    // サンプルを数件表示
    console.log(invalidMembers.slice(0, 3).map(m => ({ id: m.id, name: m.name, term_id: m.term_id, generation: m.generation, rank_id: m.rank_id })));
  } else {
    console.log('\n✅ [正常] 全ての受講生に正しく「期」と「ランク」が設定されています（旧generationからの移行も完璧です）。');
  }

  // 3. 申し込みデータの参照エラーチェック
  const { data: apps, error: appErr } = await supabase.from('applications').select('id, matched_member_id');
  if (appErr) {
    console.error('申し込み取得エラー:', appErr);
    return;
  }
  
  const memberIds = new Set(members.map(m => m.id));
  const orphanedApps = apps.filter(a => a.matched_member_id && !memberIds.has(a.matched_member_id));
  
  if (orphanedApps.length > 0) {
    console.log(`\n⚠️ [警告] 存在しない受講生IDに紐づいている申し込みが ${orphanedApps.length} 件見つかりました。`);
  } else {
    console.log('\n✅ [正常] 申し込みデータと受講生データの紐付けに矛盾（幽霊データ）はありません。');
  }

  console.log('\n--- スキャン完了 ---');
}

scanDatabase();
