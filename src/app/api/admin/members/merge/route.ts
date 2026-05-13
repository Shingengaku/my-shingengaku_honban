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
        const { primaryId, duplicateId, duplicateIds: incomingDuplicateIds, mergedData } = body;

        // 後方互換性と新フォーマットの両方をサポート
        const targetPrimaryId = primaryId;
        const targetDuplicateIds = incomingDuplicateIds || (duplicateId ? [duplicateId] : []);

        if (!targetPrimaryId || targetDuplicateIds.length === 0) {
            return NextResponse.json({ error: '統合元と統合先のIDが必要です' }, { status: 400 });
        }

        if (targetDuplicateIds.includes(targetPrimaryId)) {
            return NextResponse.json({ error: '同じデータ同士は統合できません' }, { status: 400 });
        }

        // 1. お申し込みデータの紐付けを duplicateIds から primaryId へ一括変更
        const { error: updateErr } = await supabaseAdmin
            .from('applications')
            .update({ matched_member_id: targetPrimaryId })
            .in('matched_member_id', targetDuplicateIds);

        if (updateErr) {
            console.error('Error migrating applications:', updateErr);
            throw updateErr;
        }

        // 2. primaryId のレコードを mergedData で更新 (もしあれば)
        if (mergedData && Object.keys(mergedData).length > 0) {
            // 許可されたフィールドのみを抽出
            const allowedFields = ['name', 'furigana', 'email', 'rank_id', 'term_id', 'is_tokushin', 'exclude_from_count'];
            const updatePayload: any = {};
            allowedFields.forEach(field => {
                if (field in mergedData) {
                    updatePayload[field] = mergedData[field];
                }
            });

            const { error: updateMemberErr } = await supabaseAdmin
                .from('members')
                .update(updatePayload)
                .eq('id', targetPrimaryId);

            if (updateMemberErr) {
                console.error('Error updating primary member:', updateMemberErr);
                throw updateMemberErr;
            }
        }

        // 3. duplicateIds の受講生レコードを一括削除
        const { error: deleteErr } = await supabaseAdmin
            .from('members')
            .delete()
            .in('id', targetDuplicateIds);

        if (deleteErr) {
            console.error('Error deleting duplicate members:', deleteErr);
            throw deleteErr;
        }

        return NextResponse.json({ success: true, message: '統合が完了しました' });
    } catch (e) {
        console.error('Merge Error:', e);
        return NextResponse.json({ error: '統合処理に失敗しました' }, { status: 500 });
    }
}
