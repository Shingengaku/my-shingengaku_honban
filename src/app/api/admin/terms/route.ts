
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: 全ての期を取得 (管理者用)
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('terms')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // フォールバック

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: '期の取得に失敗しました' }, { status: 500 });
    }
}

// POST: 新しい期を作成
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 });

        // max sort_order を取得して末尾に追加
        const { data: maxOrderData } = await supabaseAdmin
            .from('terms')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

        const nextOrder = (maxOrderData?.sort_order ?? 0) + 10;

        const { data, error } = await supabaseAdmin
            .from('terms')
            .insert({ name, sort_order: nextOrder })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: '期の作成に失敗しました' }, { status: 500 });
    }
}

// DELETE: 期を削除
export async function DELETE(request: Request) {

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('terms')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: '期の削除に失敗しました' }, { status: 500 });
    }
}
// PUT: 期を更新
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, sort_order } = body;

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (sort_order !== undefined) updateData.sort_order = Number(sort_order);

        const { data, error } = await supabaseAdmin
            .from('terms')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: '期の更新に失敗しました' }, { status: 500 });
    }
}
