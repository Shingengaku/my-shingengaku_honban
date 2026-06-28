
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { matchProduct, normalizeVenue, normalizeOnlineVenues } from '@/lib/venueUtils';

function parseInputGeneration(genInput: any): number | null {
    if (genInput === undefined || genInput === null || genInput === '') return null;
    const str = String(genInput).trim();
    if (str === '') return null;
    if (str === '法人' || str === '法人コース' || str === '9991') {
        return 9991;
    }
    if (str === '経営幹部' || str === '経営幹部コース' || str === '9992') {
        return 9992;
    }
    const val = parseInt(str);
    return isNaN(val) ? null : val;
}

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
                    const rawOnlineVenues = currentUpdates.online_venues !== undefined ? currentUpdates.online_venues : currentDbApp.online_venues;
                    const finalOnlineVenues = normalizeOnlineVenues(rawOnlineVenues) ?? rawOnlineVenues;
                    // 正規化した値をDBへの更新対象にも反映
                    if (currentUpdates.online_venues !== undefined && finalOnlineVenues !== currentUpdates.online_venues) {
                        currentUpdates.online_venues = finalOnlineVenues;
                    }
                    const finalMemberId = currentUpdates.matched_member_id !== undefined ? currentUpdates.matched_member_id : currentDbApp.matched_member_id;
                    let finalRankName = currentUpdates.applied_rank_name !== undefined ? currentUpdates.applied_rank_name : currentDbApp.applied_rank_name;
                    let finalRemarks = currentUpdates.remarks !== undefined ? currentUpdates.remarks : (currentDbApp.remarks || '');
                    let finalTags = currentUpdates.tags !== undefined ? currentUpdates.tags : (currentDbApp.tags || []);

                    // 1. 紹介者 (introducer) が指定された場合、直接カラムとタグを更新
                    let hasIntro = false;
                    if (body.introducer !== undefined) {
                        const introducer = body.introducer.trim();
                        currentUpdates.introducer = introducer || null;
                        
                        hasIntro = !!introducer && introducer !== 'なし' && introducer !== '未入力' && introducer !== 'ありません';

                        // タグの同期
                        if (hasIntro) {
                            if (!finalTags.includes('ご紹介')) {
                                finalTags = [...finalTags, 'ご紹介'];
                            }
                        } else {
                            finalTags = finalTags.filter((t: string) => t !== 'ご紹介');
                        }
                        currentUpdates.tags = finalTags;
                    } else {
                        // introducerが送信されなかった場合のhasIntro判定 (DBの既存値から)
                        const existingIntro = currentDbApp.introducer;
                        hasIntro = !!existingIntro && existingIntro !== 'なし' && existingIntro !== '未入力' && existingIntro !== 'ありません';
                    }

                    const normalizeRankName = (name: string) => {
                        if (name === '神言学未受講 (一般)') return '神言学未受講（一般）';
                        if (name === '神言学未受講 (ご紹介)') return '神言学未受講（ご紹介）';
                        return name || '';
                    };
                    
                    const originalRankName = normalizeRankName(currentDbApp.applied_rank_name);
                    const updatedRankName = normalizeRankName(currentUpdates.applied_rank_name);

                    // ユーザーが手動で属性を変更したかどうかを判定
                    const isRankManuallyChanged = currentUpdates.applied_rank_name !== undefined && 
                                                  updatedRankName !== originalRankName;

                    if (['神言学未受講（一般）', '神言学未受講（ご紹介）'].includes(normalizeRankName(finalRankName)) || 
                        ['神言学未受講（一般）', '神言学未受講（ご紹介）'].includes(originalRankName)) {
                        
                        if (isRankManuallyChanged) {
                            // ユーザーが手動でドロップダウンを変更した場合はその選択を優先
                            finalRankName = updatedRankName;
                        } else {
                            // 手動変更されていない場合は、紹介者テキストの有無に完全に連動させる
                            if (hasIntro) {
                                finalRankName = '神言学未受講（ご紹介）';
                            } else {
                                finalRankName = '神言学未受講（一般）';
                            }
                        }
                        currentUpdates.applied_rank_name = finalRankName;
                    }

                    // 3. 商品マッチングと料金の再計算
                    const { data: settingsData } = await supabaseAdmin
                        .from('app_settings')
                        .select('*');

                    const paymentLinks = settingsData?.find((row: any) => row.key === 'payment_links')?.value || [];

                    let rankId: string | null = null;
                    try {
                        const { data: rankData } = await supabaseAdmin
                            .from('ranks')
                            .select('id')
                            .eq('name', finalRankName)
                            .single();
                        if (rankData) rankId = String(rankData.id);
                    } catch {}

                    // payment_key は渡さない（古い値で誤マッチするのを防ぐ）
                    // rank_id が null でも rank_name でフォールバックマッチされる
                    const matchedProduct = matchProduct(paymentLinks, {
                        venue: finalVenue,
                        social_venue: finalSocialVenue || 'ー',
                        participation_type: finalParticipationType || 'venue',
                        online_venues: finalOnlineVenues,
                        rank_id: rankId,
                        rank_name: finalRankName
                        // payment_key: あえて渡さない
                    });

                    if (matchedProduct) {
                        const totalAmount = Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee);
                        // サーバー側マッチング結果を必ず優先（フロントから来た古いpayment_keyを上書き）
                        currentUpdates.total_amount = totalAmount;
                        currentUpdates.payment_key = matchedProduct.key;
                        
                        // 懇親会の参加フラグも更新（'none' はDB内部の「参加しない」値なので除外）
                        currentUpdates.attend_social = !!(finalSocialVenue && finalSocialVenue !== '参加しない' && finalSocialVenue !== 'none' && finalSocialVenue !== 'ー');

                        // 以前が unpaid の場合に限り、金額0円になれば自動的に paid に切り替える
                        const currentPaymentStatus = currentUpdates.payment_status !== undefined ? currentUpdates.payment_status : currentDbApp.payment_status;
                        if (currentPaymentStatus === 'unpaid' && totalAmount === 0) {
                            currentUpdates.payment_status = 'paid';
                        }

                        console.log(`[edit] 料金再計算: ${finalRankName} / ${matchedProduct.key} => ${totalAmount}円`);
                    } else {
                        console.warn(`[edit] 商品マッチング失敗: rank=${finalRankName}(id=${rankId}), venue=${finalVenue}, social=${finalSocialVenue}`);
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

            // メンバーマスタ (members) への自動更新処理は、データの安全性を担保するため行いません。
            // 申込データとマスタの紐付け (matched_member_id の更新) のみを行います。

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
