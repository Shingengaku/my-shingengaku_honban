import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            input_name,
            input_furigana,
            input_email,
            venue,
            social_venue,
            applied_rank_name,
            total_amount,
            payment_status,
            remarks,
            participation_type,
            cc_email,
            bcc_email,
            member_generation,
            matched_member_id
        } = body;

        // 必須チェック（ダッシュボードからの手動登録なので、ある程度緩くすることも可能ですが、基本は合わせます）
        if (!input_name || !venue) {
            return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
        }

        const attendSocial = (social_venue && social_venue !== 'none' && social_venue !== '参加しない');

        // memberの処理
        let targetMemberId = matched_member_id || null;

        // targetMemberIdがなく、期が指定されている場合、メンバーを検索または作成
        if (!targetMemberId && member_generation) {
            // term_id を特定 (例: 11 -> "11期" を探す)
            const { data: terms } = await supabaseAdmin
                .from('terms')
                .select('id, name');
            
            const targetTerm = terms?.find(t => 
                t.name === String(member_generation) || 
                t.name === `${member_generation}期`
            );

            if (targetTerm) {
                const { data: existingMembers, error: memberError } = await supabaseAdmin
                    .from('members')
                    .select('id, name')
                    .eq('term_id', targetTerm.id);

                if (!memberError && existingMembers) {
                    const normalizedInputName = input_name.replace(/[\s\u3000]+/g, '');
                    const member = existingMembers.find(m => m.name.replace(/[\s\u3000]+/g, '') === normalizedInputName);
                    if (member) {
                        targetMemberId = member.id;
                    }
                }

                // 見つからない場合は新規作成
                if (!targetMemberId && input_email) {
                    const { data: newMember, error: createError } = await supabaseAdmin
                        .from('members')
                        .insert({
                            name: input_name,
                            email: input_email,
                            furigana: input_furigana || '',
                            term_id: targetTerm.id,
                            generation: member_generation // 念のため古いカラムもセット
                        })
                        .select('id')
                        .single();

                    if (!createError && newMember) {
                        targetMemberId = newMember.id;
                    }
                }
            } else {
                console.warn(`Term not found for generation: ${member_generation}`);
                // 期が見つからないが、世代情報だけ保存したい場合のフォールバック（旧カラムのみ）
                if (input_email) {
                    const { data: newMember } = await supabaseAdmin
                        .from('members')
                        .insert({
                            name: input_name,
                            email: input_email,
                            furigana: input_furigana || '',
                            generation: member_generation
                        })
                        .select('id')
                        .single();
                    if (newMember) targetMemberId = newMember.id;
                }
            }
        }

        const isOnline = (participation_type === 'online');

        const { data, error: insertError } = await supabaseAdmin
            .from('applications')
            .insert({
                input_name,
                input_furigana: input_furigana || '',
                input_email: input_email || '',
                venue,
                social_venue: isOnline ? 'none' : (social_venue || 'none'),
                attend_social: isOnline ? false : attendSocial,
                total_amount: total_amount || 0,
                payment_status: payment_status || (total_amount === 0 ? 'paid' : 'unpaid'),
                applied_rank_name: applied_rank_name || '一般',
                matched_member_id: targetMemberId,
                remarks: remarks || null,
                participation_type: participation_type || 'venue',
                online_venues: isOnline ? (body.online_venues || null) : null,
                cc_email: cc_email || null,
                bcc_email: bcc_email || null,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Manual insert error:', insertError);
            return NextResponse.json({
                error: '申込情報の保存に失敗しました',
                details: insertError.message
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: data.id, message: 'Application manually created' });

    } catch (e: any) {
        console.error('Manual Create Handler Error:', e);
        return NextResponse.json({
            error: 'Server Error',
            details: e?.message || JSON.stringify(e)
        }, { status: 500 });
    }
}
