
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
            let attempt = 0;
            const maxRetries = 5;

            while (attempt < maxRetries) {
                const { error: appError } = await supabaseAdmin
                    .from('applications')
                    .update(currentUpdates)
                    .eq('id', id);

                if (!appError) {
                    console.log('Application update successful');
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
