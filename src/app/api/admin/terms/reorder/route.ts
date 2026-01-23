
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items } = body; // { id: number, sort_order: number } の配列

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'データ形式が無効です' }, { status: 400 });
        }

        // Supabaseは、RPCや複雑なupsertロジックなしで、JSクライアントを介して1つのクエリで異なる値を持つ一括更新を簡単にはサポートしていません。
        // 期の数は少ないため（通常100未満）、今のところループします。
        // あるいは、すべての必須フィールドを含めればupsertを使用できますが、sort_orderのみを更新したいです。
        // ここではPromise.allで更新を使用しましょう。

        // 注: 原子的操作のためにRPCを使用するのが理想的ですが、この規模ではJSループでも許容されます。

        const updates = items.map((item: any) =>
            supabaseAdmin
                .from('terms')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id)
        );

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Reorder error:', e);
        return NextResponse.json({ error: '並び替えに失敗しました' }, { status: 500 });
    }
}
