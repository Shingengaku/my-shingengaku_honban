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
            member_generation
        } = body;

        // 必須チェック（ダッシュボードからの手動登録なので、ある程度緩くすることも可能ですが、基本は合わせます）
        if (!input_name || !venue) {
            return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
        }

        const attendSocial = (social_venue && social_venue !== 'none' && social_venue !== '参加しない');

        // memberの処理
        let targetMemberId = null;

        // 期が指定されている場合、メンバーを検索または作成
        if (member_generation) {
            const { data: existingMembers, error: memberError } = await supabaseAdmin
                .from('members')
                .select('id, name')
                .eq('generation', member_generation);

            if (!memberError && existingMembers) {
                const normalizedInputName = input_name.replace(/\s+/g, '');
                const member = existingMembers.find(m => m.name.replace(/\s+/g, '') === normalizedInputName);
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
                        generation: member_generation
                    })
                    .select('id')
                    .single();

                if (!createError && newMember) {
                    targetMemberId = newMember.id;
                }
            }
        }

        const { data, error: insertError } = await supabaseAdmin
            .from('applications')
            .insert({
                input_name,
                input_furigana: input_furigana || '',
                input_email: input_email || '',
                venue,
                social_venue: social_venue || 'none',
                attend_social: attendSocial,
                total_amount: total_amount || 0,
                payment_status: payment_status || 'unpaid',
                applied_rank_name: applied_rank_name || '一般',
                matched_member_id: targetMemberId,
                remarks: remarks || null,
                participation_type: participation_type || 'venue',
                online_venues: body.online_venues || null,
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
