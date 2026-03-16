import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, type, tags, is_admin } = body;

        // type: 'receipt_issued' | 'invoice_issued'
        if (!id || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const tagToAdd = type === 'receipt_issued' ? 'receipted' : 'invoiced';

        // 現在のアプリケーションデータを取得
        const { data: currentData, error: fetchError } = await supabaseAdmin
            .from('applications')
            .select('tags')
            .eq('id', id)
            .single();

        if (fetchError || !currentData) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 });
        }

        let currentTags: string[] = currentData.tags || [];

        // 【要件】お客様からの操作で、既にその種類のタグが付いている場合はエラー（再発行不可）にする
        if (!is_admin) {
            if (currentTags.includes(tagToAdd)) {
                return NextResponse.json({ 
                    error: 'ALREADY_ISSUED',
                    message: '既に発行済みです。再発行が必要な場合は管理者へお問い合わせください。'
                }, { status: 403 });
            }
        }

        // タグ更新処理 (管理者の場合、明示的にタグ配列が送られてくる場合と、追加のみの場合がある)
        let newTags = [...currentTags];
        if (tags !== undefined && Array.isArray(tags)) {
            // 管理者がタグ一覧を直接指定して上書きする場合
            newTags = tags;
        } else {
            if (!newTags.includes(tagToAdd)) {
                newTags.push(tagToAdd);
            }
        }

        // update
        const { data: updatedData, error: updateError } = await supabaseAdmin
            .from('applications')
            .update({ tags: newTags })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json(updatedData);

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
