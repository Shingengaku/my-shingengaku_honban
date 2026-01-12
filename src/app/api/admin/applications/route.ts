
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { getPaymentKey } from '@/lib/payment';

export async function GET() {
  // ... (comments omitted)

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select(`
      *,
      members (
        generation,
        furigana,
        ranks (
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
  // 1. ランク順 (ASC, nulls last -> 一般)
  // 2. 期順 (ASC, nulls last)
  // 3. ふりがな順 (ASC)

  const sortedData = data.sort((a, b) => {
    // 1. ランク順
    const rankOrderA = a.members?.ranks?.sort_order ?? 999;
    const rankOrderB = b.members?.ranks?.sort_order ?? 999;
    if (rankOrderA !== rankOrderB) return rankOrderA - rankOrderB;

    // 2. 期順
    const genA = a.members?.generation ?? 9999;
    const genB = b.members?.generation ?? 9999;
    if (genA !== genB) return genA - genB;

    // 3. ふりがな順
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

    return {
      ...app,
      payment_key: app.payment_key || getPaymentKey(rankName, venue, social_venue)
    };
  });

  return NextResponse.json(responseData);
}
