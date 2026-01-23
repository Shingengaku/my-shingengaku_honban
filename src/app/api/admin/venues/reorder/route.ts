
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items } = body; // { id: number, sort_order: number } の配列

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'データ形式が無効です' }, { status: 400 });
        }

        const updates = items.map((item: any) =>
            supabaseAdmin
                .from('venues')
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
