
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { matchProduct, normalizeVenue } from '@/lib/venueUtils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, type, ...updates } = body;
        // type: 'cancel' | 'update'

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        if (type === 'cancel') {
            const { error } = await supabaseAdmin
                .from('applications')
                .update({ payment_status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;

            // 子レコードも連動してキャンセル
            const { error: childError } = await supabaseAdmin
                .from('applications')
                .update({ payment_status: 'cancelled' })
                .eq('parent_application_id', id);

            if (childError) {
                console.error('Failed to cancel child applications:', childError);
            }

            return NextResponse.json({ success: true });
        }

        if (type === 'update') {
            // 特殊フィールドを抽出
            // 備考: 厳密に言えば、このカラムはまだ存在しない可能性があります。
            // ユーザーが追加していない場合、この更新は失敗します。
            // 更新を試みますが、失敗した場合はフォールバックする可能性があります？
            // 今のところ、含めてみます。失敗した場合、ユーザーはカラムを追加する必要があります。
            // 待ってください、安全を期して「エラーを修正」するために、まずは標準カラムを想定しましょう。

            // 実際には、'applications' に渡すものを制御するために厳密に分割代入しましょう
            console.log('Received updates:', updates);

            const {
                member_generation,
                updated_at,
                introducer,
                ...appUpdates
            } = updates;

            // 楽観的ロック (Optimistic Locking) チェック
            if (updated_at) {
                const { data: currentApp, error: fetchError } = await supabaseAdmin
                    .from('applications')
                    .select('updated_at')
                    .eq('id', id)
                    .single();

                if (fetchError || !currentApp) {
                    // レコードが見つからない場合は別のエラーかもしれませんが、ここでは続行させます（updateで失敗するはず）
                    // あるいは厳密にエラーにするか。
                } else {
                    const dbTime = new Date(currentApp.updated_at).getTime();
                    const reqTime = new Date(updated_at).getTime();

                    // 許容誤差を考慮する必要があるか？ 通常はISO文字列完全一致を期待。
                    // しかし、JSのDate変換でミリ秒の扱いが異なる場合があるため、1秒未満の誤差は許容しても良いかも。
                    // ここでは厳密一致（文字列比較）または getTime() 比較で、1000ms以上の差があればアウトにする。
                    if (Math.abs(dbTime - reqTime) > 1000) {
                        return NextResponse.json({ error: 'Conflict: Data has been modified by another user.', code: 'CONFLICT' }, { status: 409 });
                    }
                }
            }

            console.log('App updates to apply:', appUpdates);

            let currentUpdates = { ...appUpdates };

            // 参加形式に応じて不要なデータをクリア
            if (currentUpdates.participation_type === 'venue') {
                currentUpdates.online_venues = null;
            } else if (currentUpdates.participation_type === 'online') {
                currentUpdates.social_venue = 'none';
                currentUpdates.attend_social = false;
            }

            // DBから現在の情報を取得し、紹介者の反映や料金の再計算を行う
            try {
                const { data: currentDbApp, error: dbFetchError } = await supabaseAdmin
                    .from('applications')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (!dbFetchError && currentDbApp) {
                    // 各項目の最終的な決定値 (入力された値 または 現在のDB値)
                    const finalVenue = currentUpdates.venue !== undefined ? normalizeVenue(currentUpdates.venue) : currentDbApp.venue;
                    const finalSocialVenue = currentUpdates.social_venue !== undefined ? normalizeVenue(currentUpdates.social_venue) : currentDbApp.social_venue;
                    const finalParticipationType = currentUpdates.participation_type !== undefined ? currentUpdates.participation_type : currentDbApp.participation_type;
                    const finalOnlineVenues = currentUpdates.online_venues !== undefined ? currentUpdates.online_venues : currentDbApp.online_venues;
                    const finalMemberId = currentUpdates.matched_member_id !== undefined ? currentUpdates.matched_member_id : currentDbApp.matched_member_id;
                    let finalRankName = currentUpdates.applied_rank_name !== undefined ? currentUpdates.applied_rank_name : currentDbApp.applied_rank_name;
                    let finalRemarks = currentUpdates.remarks !== undefined ? currentUpdates.remarks : (currentDbApp.remarks || '');
                    let finalTags = currentUpdates.tags !== undefined ? currentUpdates.tags : (currentDbApp.tags || []);

                    // 1. 紹介者 (introducer) が指定された場合、備考欄およびタグを更新する
                    if (body.introducer !== undefined) {
                        const introducer = body.introducer.trim();
                        let remarksText = finalRemarks;

                        // 備考欄の中の「紹介者: XXX」の置換または追加
                        if (remarksText.includes('紹介者:')) {
                            remarksText = remarksText.replace(/紹介者:\s*[^\n]*/g, introducer ? `紹介者: ${introducer}` : '紹介者: なし');
                        } else if (introducer) {
                            remarksText = remarksText ? `${remarksText}\n紹介者: ${introducer}` : `紹介者: ${introducer}`;
                        }
                        
                        finalRemarks = remarksText;
                        currentUpdates.remarks = finalRemarks;

                        // タグの同期
                        if (introducer) {
                            if (!finalTags.includes('ご紹介')) {
                                finalTags = [...finalTags, 'ご紹介'];
                            }
                        } else {
                            finalTags = finalTags.filter((t: string) => t !== 'ご紹介');
                        }
                        currentUpdates.tags = finalTags;
                    }

                    // 2. 一般申し込み（matched_member_id が null）の場合に、紹介者有無により属性名を自動変更する
                    const hasIntro = finalRemarks.includes('紹介者:') && 
                                     !finalRemarks.includes('紹介者: なし') && 
                                     !finalRemarks.includes('紹介者: 未入力') &&
                                     !finalRemarks.includes('紹介者: ありません') && 
                                     finalRemarks.match(/紹介者:\s*([^\n]+)/)?.[1]?.trim() !== '';

                    if (!finalMemberId) {
                        if (hasIntro) {
                            finalRankName = '神言学未受講（ご紹介）';
                        } else {
                            finalRankName = '神言学未受講（一般）';
                        }
                        currentUpdates.applied_rank_name = finalRankName;
                    }

                    // 3. 商品マッチングと料金の再計算
                    const { data: settingsData } = await supabaseAdmin
                        .from('app_settings')
                        .select('*');

                    const paymentLinks = settingsData?.find(row => row.key === 'payment_links')?.value || [];

                    let rankId = null;
                    try {
                        const { data: rankData } = await supabaseAdmin
                            .from('ranks')
                            .select('id')
                            .eq('name', finalRankName)
                            .single();
                        if (rankData) rankId = String(rankData.id);
                    } catch {}

                    const matchedProduct = matchProduct(paymentLinks, {
                        venue: finalVenue,
                        social_venue: finalSocialVenue || 'ー',
                        participation_type: finalParticipationType || 'venue',
                        online_venues: finalOnlineVenues,
                        rank_id: rankId,
                        rank_name: finalRankName
                    });

                    if (matchedProduct) {
                        const totalAmount = Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee);
                        currentUpdates.total_amount = totalAmount;
                        currentUpdates.payment_key = matchedProduct.key;
                        
                        // 懇親会の参加フラグも更新
                        currentUpdates.attend_social = (finalSocialVenue && finalSocialVenue !== '参加しない');

                        // 以前が unpaid の場合に限り、金額0円になれば自動的に paid に切り替える
                        const currentPaymentStatus = currentUpdates.payment_status !== undefined ? currentUpdates.payment_status : currentDbApp.payment_status;
                        if (currentPaymentStatus === 'unpaid' && totalAmount === 0) {
                            currentUpdates.payment_status = 'paid';
                        }
                    }
                }
            } catch (calcError) {
                console.error('Error recalculating rates in edit API:', calcError);
            }

            let attempt = 0;
            const maxRetries = 5;

            while (attempt < maxRetries) {
                const { error: appError } = await supabaseAdmin
                    .from('applications')
                    .update(currentUpdates)
                    .eq('id', id);

                if (!appError) {
                    console.log('Application update successful');

                    // 支払ステータスが更新された場合、子レコードにも同期する
                    if (currentUpdates.payment_status) {
                        const { error: childSyncError } = await supabaseAdmin
                            .from('applications')
                            .update({ payment_status: currentUpdates.payment_status })
                            .eq('parent_application_id', id);
                        if (childSyncError) {
                            console.error('Failed to sync child applications payment status:', childSyncError);
                        }
                    }
                    break;
                }

                console.error('Application update error:', appError);

                // カラム欠落エラーの確認 (Postgresコード 42703)
                // メッセージ形式: column "remarks" of relation "applications" does not exist
                const isMissingColumn = appError.code === '42703';
                let missingCol = null;

                if (isMissingColumn) {
                    // エラーメッセージに含まれる currentUpdates のキーを検索
                    // Postgresは通常、カラム名を引用符で囲みます: column "foo" ...
                    missingCol = Object.keys(currentUpdates).find(key =>
                        appError.message.includes(`"${key}"`) ||
                        appError.message.includes(`'${key}'`) ||
                        appError.message.includes(key) // 引用符なしのフォールバック
                    );
                }

                if (isMissingColumn && missingCol && currentUpdates[missingCol] !== undefined) {
                    console.warn(`Column '${missingCol}' missing in DB. stripping from update payload and retrying...`);
                    delete currentUpdates[missingCol];
                    attempt++;
                } else {
                    // カラム欠落エラーではない、またはカラム名を解析できなかった、またはカラムがペイロードにない場合
                    console.error('Application Update Error details:', { code: appError.code, message: appError.message, details: appError.details });
                    throw appError;
                }
            }

            // メンバー詳細（期とふりがな）が提供されている場合は更新
            // まず matched_member_id を取得する必要があります
            const { data: appData, error: fetchError } = await supabaseAdmin
                .from('applications')
                .select('matched_member_id, input_name, input_furigana, input_email') // 入力も取得
                .eq('id', id)
                .single();

            if (fetchError) console.error('Error fetching application for member update:', fetchError);
            console.log('Matched Member ID:', appData?.matched_member_id);

            let targetMemberId = appData?.matched_member_id;

            // メンバーが一致しないが期を保存する必要がある場合、メンバーを作成します。
            if (!targetMemberId && member_generation !== undefined && member_generation !== null) {
                console.log('No matched member, attempting to create new member for Term storage...');
                const name = appUpdates.input_name || appData?.input_name;
                const email = appUpdates.input_email || appData?.input_email;
                const furigana = appUpdates.input_furigana || appData?.input_furigana;

                if (email) {
                    const { data: terms } = await supabaseAdmin
                        .from('terms')
                        .select('id, name');
                    const targetTerm = terms?.find(t => 
                        t.name === String(member_generation) || 
                        t.name === `${member_generation}期`
                    );

                    const { data: newMember, error: createError } = await supabaseAdmin
                        .from('members')
                        .insert({
                            name: name || 'Unknown',
                            email: email,
                            furigana: furigana || '',
                            generation: member_generation,
                            term_id: targetTerm?.id || null
                        })
                        .select('id')
                        .single();

                    if (createError) {
                        console.error('Failed to create new member:', createError);
                    } else if (newMember) {
                        targetMemberId = newMember.id;
                        // アプリケーションに再リンク
                        await supabaseAdmin
                            .from('applications')
                            .update({ matched_member_id: targetMemberId })
                            .eq('id', id);
                        console.log('Created and linked new member:', targetMemberId);
                    }
                } else {
                    console.warn('Cannot create member without email');
                }
            }

            if (targetMemberId) {
                const memberUpdates: any = {};

                if (member_generation !== undefined && member_generation !== null) {
                    memberUpdates.generation = member_generation;

                    // term_id も generation に合わせて同期する
                    // terms テーブルで name = member_generation または name = member_generation + "期" の行を検索
                    const { data: terms } = await supabaseAdmin
                        .from('terms')
                        .select('id, name');
                    
                    const targetTerm = terms?.find(t => 
                        t.name === String(member_generation) || 
                        t.name === `${member_generation}期`
                    );

                    if (targetTerm?.id) {
                        memberUpdates.term_id = targetTerm.id;
                    }
                }

                // アプリケーションで変更された場合、ふりがなを同期
                if (appUpdates.input_furigana) {
                    memberUpdates.furigana = appUpdates.input_furigana;
                }

                console.log('Member updates to apply:', memberUpdates);

                if (Object.keys(memberUpdates).length > 0) {
                    const { error: memberError } = await supabaseAdmin
                        .from('members')
                        .update(memberUpdates)
                        .eq('id', targetMemberId);

                    if (memberError) console.error('Error updating member:', memberError);
                    else console.log('Member update successful');
                }
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (e: any) {
        console.error('Update Handler Error:', e);
        return NextResponse.json({
            error: 'Server Error',
            details: e?.message || JSON.stringify(e, null, 2)
        }, { status: 500 });
    }
}
