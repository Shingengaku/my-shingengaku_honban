import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { primaryId, duplicateId } = body;

        if (!primaryId || !duplicateId) {
            return NextResponse.json({ error: '統合元と統合先のIDが必要です' }, { status: 400 });
        }

        if (primaryId === duplicateId) {
            return NextResponse.json({ error: '同じデータ同士は統合できません' }, { status: 400 });
        }

        // 1. お申し込みデータの紐付けを duplicateId から primaryId へ変更
        const { error: updateErr } = await supabaseAdmin
            .from('applications')
            .update({ matched_member_id: primaryId })
            .eq('matched_member_id', duplicateId);

        if (updateErr) {
            console.error('Error migrating applications:', updateErr);
            throw updateErr;
        }

        // 2. duplicateId の受講生レコードを削除
        const { error: deleteErr } = await supabaseAdmin
            .from('members')
            .delete()
            .eq('id', duplicateId);

        if (deleteErr) {
            console.error('Error deleting duplicate member:', deleteErr);
            throw deleteErr;
        }

        return NextResponse.json({ success: true, message: '統合が完了しました' });
    } catch (e) {
        console.error('Merge Error:', e);
        return NextResponse.json({ error: '統合処理に失敗しました' }, { status: 500 });
    }
}
