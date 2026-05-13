
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeName } from '@/lib/kanjiNormalize';

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
        const { name, furigana, email, rank_id, term_id, is_tokushin, exclude_from_count } = body;

        // バリデーション
        if (!name || !furigana || !email || !rank_id || !term_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 漢字マッピングの取得
        const { data: kanjiSetting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'kanji_mapping')
            .single();
        const customKanjiMap = kanjiSetting?.value || undefined;

        // 1. 重複チェック (正規化後の氏名 + 期)
        const normalizedInputName = normalizeName(name, customKanjiMap);
        const { data: existing } = await supabaseAdmin
            .from('members')
            .select('id, name')
            .eq('term_id', term_id);

        const nameDuplicate = existing?.find(m => normalizeName(m.name, customKanjiMap) === normalizedInputName);
        if (nameDuplicate) {
            return NextResponse.json({ error: `同じ期に同姓同名（表記ゆれ含む）の受講生が既に登録されています: ${nameDuplicate.name}` }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('members')
            .insert({
                name,
                furigana,
                email,
                rank_id,
                term_id,
                is_tokushin: is_tokushin || false,
                exclude_from_count: exclude_from_count || false
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
        const { id, name, furigana, email, rank_id, term_id, is_tokushin, exclude_from_count } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // 漢字マッピングの取得
        const { data: kanjiSetting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'kanji_mapping')
            .single();
        const customKanjiMap = kanjiSetting?.value || undefined;

        // 1. 重複チェック (正規化後の氏名 + 期)
        if (name && term_id) {
            const normalizedInputName = normalizeName(name, customKanjiMap);
            
            const { data: existing } = await supabaseAdmin
                .from('members')
                .select('id, name')
                .eq('term_id', term_id)
                .neq('id', id); // 自身を除外

            const nameDuplicate = existing?.find(m => normalizeName(m.name, customKanjiMap) === normalizedInputName);
            if (nameDuplicate) {
                return NextResponse.json({ error: `同じ期に同姓同名（表記ゆれ含む）の受講生が既に登録されています: ${nameDuplicate.name}` }, { status: 400 });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('members')
            .update({
                name,
                furigana,
                email,
                rank_id,
                term_id,
                is_tokushin,
                exclude_from_count
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

        const targetIds = ids || (id ? [id] : []);
        if (targetIds.length === 0) return NextResponse.json({ error: 'ID or IDs are required' }, { status: 400 });

        // 1. お申し込みデータで利用されているメンバーを特定する
        const { data: usedApps, error: checkErr } = await supabaseAdmin
            .from('applications')
            .select('matched_member_id')
            .in('matched_member_id', targetIds);

        if (checkErr) throw checkErr;

        const usedMemberIds = new Set(usedApps.filter(app => app.matched_member_id).map(app => String(app.matched_member_id)));
        const unusedMemberIds = targetIds.filter(tid => !usedMemberIds.has(String(tid)));

        // 全て利用中で削除できるものがない場合
        if (unusedMemberIds.length === 0) {
            return NextResponse.json({ 
                error: '選択された受講生は既にお申し込みデータと紐づいているため削除できません。',
                skipped: targetIds.length,
                deleted: 0
            }, { status: 400 });
        }

        // 2. 利用されていないメンバーのみ削除を実行
        const { error: delErr } = await supabaseAdmin
            .from('members')
            .delete()
            .in('id', unusedMemberIds);

        if (delErr) throw delErr;

        return NextResponse.json({ 
            success: true, 
            deleted: unusedMemberIds.length,
            skipped: usedMemberIds.size,
            message: usedMemberIds.size > 0 
                ? `${unusedMemberIds.length}件を削除しました。\n（お申し込みと紐づいている${usedMemberIds.size}件は安全のためスキップしました）` 
                : '削除しました'
        });
    } catch (e) {
        console.error('Error deleting member:', e);
        return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }
}
