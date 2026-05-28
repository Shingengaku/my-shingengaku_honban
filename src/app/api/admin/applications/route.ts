
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function parseGeneration(termName: string, memberGen: any, fallback: string): number {
  const name = termName || '';
  if (name.includes('法人')) {
    return 9991;
  }
  if (name.includes('経営幹部')) {
    return 9992;
  }
  const val = parseInt(name || memberGen || fallback);
  return isNaN(val) ? 0 : val;
}




export const dynamic = 'force-dynamic';

export async function GET() {
  // ... (comments omitted)


  const { data, error } = await supabaseAdmin
    .from('applications')
    .select(`
      *,
      members (
        terms ( name ),
        generation,
        furigana,
        is_tokushin,
        ranks (
          id,
          name,
          base_fee,
          sort_order
        )
      )
    `);

  if (error) {

    return NextResponse.json({ error: error.message }, { status: 500 });
  }



  // ソートロジック
  // 1. 申込日時順 (DESC -> 新しいもの順)
  // 2. ランク順 (ASC, nulls last -> 一般)
  // 3. 期順 (ASC, nulls last)
  // 4. ふりがな順 (ASC)

  const sortedData = data.sort((a, b) => {
    // 1. 申込日時順 (新しいもの順)
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    if (dateA !== dateB) return dateB - dateA;

    // 2. ランク順
    const rankOrderA = a.members?.ranks?.sort_order ?? 999;
    const rankOrderB = b.members?.ranks?.sort_order ?? 999;
    if (rankOrderA !== rankOrderB) return rankOrderA - rankOrderB;

    // 3. 期順
    const genA = parseGeneration(a.members?.terms?.name || '', a.members?.generation, '9999');
    const genB = parseGeneration(b.members?.terms?.name || '', b.members?.generation, '9999');
    if (genA !== genB) return genA - genB;

    // 4. ふりがな順
    // マスタのふりがなを優先、なければ入力ふりがな
    const furiganaA = a.members?.furigana || a.input_furigana || '';
    const furiganaB = b.members?.furigana || b.input_furigana || '';
    return furiganaA.localeCompare(furiganaB, 'ja');
  });

  // キーを付加して返す
  const responseData = sortedData.map(app => {
    const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
    const venue = app.venue;
    const social_venue = app.social_venue || 'none';

    const generation = parseGeneration(app.members?.terms?.name || '', app.members?.generation, '0');
    // フロントエンド向けにメンバー構造をフラット化
    const members = app.members ? { ...app.members, generation } : null;

    return {
      ...app,
      input_name: app.input_name || '',
      input_email: app.input_email || '',
      input_furigana: app.input_furigana || '',
      tags: Array.isArray(app.tags) ? app.tags : [],
      members,
      payment_key: app.payment_key
    };
  });

  return NextResponse.json(responseData);
}
