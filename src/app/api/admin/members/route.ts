
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { data, error } = await supabaseAdmin
            .from('members')
            .select(`
                *,
                ranks (
                    id,
                    name
                ),
                terms (
                    id,
                    name
                )
            `)
            .order('term_id', { ascending: true })
            .order('furigana', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error fetching members:', e);
        return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, furigana, email, rank_id, term_id, is_tokushin } = body;

        // バリデーション
        if (!name || !furigana || !email || !rank_id || !term_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('members')
            .insert({
                name,
                furigana,
                email,
                rank_id,
                term_id,
                is_tokushin: is_tokushin || false
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error creating member:', e);
        return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, furigana, email, rank_id, term_id, is_tokushin } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('members')
            .update({
                name,
                furigana,
                email,
                rank_id,
                term_id,
                is_tokushin
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error updating member:', e);
        return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // 一括削除対応：リクエストボディからidsを取得を試みる
        let ids: string[] | null = null;
        try {
            const body = await request.clone().json();
            if (body && Array.isArray(body.ids)) {
                ids = body.ids;
            }
        } catch (e) {
            // ボディがない場合は無視
        }

        if (!id && !ids) return NextResponse.json({ error: 'ID or IDs are required' }, { status: 400 });

        // 外部キー制約エラー（applications_matched_member_id_fkey）を回避するため、
        // 対象メンバーが紐づいている申し込みデータの紐付けを事前に解除（NULL化）する
        try {
            let updateAppQuery = supabaseAdmin.from('applications').update({ matched_member_id: null });
            if (ids) {
                updateAppQuery = updateAppQuery.in('matched_member_id', ids);
            } else {
                updateAppQuery = updateAppQuery.eq('matched_member_id', id as string);
            }
            await updateAppQuery;
        } catch (updateErr) {
            console.error('Error unlinking applications:', updateErr);
            // エラーが発生しても削除処理は続行を試みる
        }

        let query = supabaseAdmin.from('members').delete();
        if (ids) {
            query = query.in('id', ids);
        } else {
            query = query.eq('id', id as string);
        }

        const { error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error deleting member:', e);
        return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }
}
