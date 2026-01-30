import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { processEmailTemplate, DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_TEMPLATE_GENERAL } from '@/lib/emailTemplate';

// 型定義
interface ApplyRequest {
    name: string;
    furigana: string;
    email: string;
    venue: string; // 'tokyo'（東京）, 'fukuoka'（福岡）, 'both'（両方）, 'none'（なし）
    social_venue: string; // 'none'（なし）, 'tokyo'（東京）, 'fukuoka'（福岡）, 'both'（両方）
    term_id?: string; // 非受講生の場合は任意
    introducer?: string;
    no_introducer?: boolean;
    participation_type?: string;
    remarks?: string;
}

interface PaymentLinkItem {
    name: string;
    lecture_fee: string;
    social_fee: string;
    key: string;
    url: string;
    venue_lecture?: string;
    venue_social?: string;
    rank_id?: string;
}

interface AppSettings {
    payment_links: PaymentLinkItem[];
    admin_email?: string;
    admin_bcc_email?: string;
}

const venueDisplayMap: Record<string, string> = {
    'tokyo': '東京',
    'fukuoka': '福岡',
    'both': '両方参加',
    'none': '参加しません'
};

export async function POST(request: Request) {
    try {
        const body: ApplyRequest = await request.json();
        let { name, furigana, email, venue, social_venue, term_id, introducer, no_introducer, participation_type, remarks: userRemarks } = body;

        // 0. データの正規化
        if (name) {
            name = name.replace(/\s+/g, '');
        }
        if (email) {
            email = email.trim().toLowerCase();
        }

        // 基本バリデーション
        if (!name || !furigana || !email || !venue) {
            return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
        }

        let rankName = '一般';
        let memberId = null;
        let rankId = null;

        // 1. Membersマスタと照合 (受講生の場合のみ)
        if (term_id) {
            // 条件: 名前 (スペース無視) AND 期 (term_id)
            const { data: allMembers, error: memberError } = await supabaseAdmin
                .from('members')
                .select('*, ranks(id, name)')
                .eq('term_id', term_id);

            if (memberError) {
                console.error('Member lookup error:', memberError);
                return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
            }

            const normalizedInputName = name.replace(/\s+/g, '');

            // 名前でマッチング
            const member = allMembers?.find(m =>
                m.name.replace(/\s+/g, '') === normalizedInputName
            ) || null;

            if (member) {
                rankId = member.ranks?.id ? String(member.ranks.id) : null;
                rankName = member.ranks?.name || '一般';
                memberId = member.id;
            }
        } else {
            // 一般参加者の場合、紹介者の有無で属性を自動決定
            if (introducer) {
                rankName = '神言学未受講（ご紹介）';
            } else {
                rankName = '神言学未受講（一般）';
            }

            // 属性IDを取得
            try {
                const { data: rankData } = await supabaseAdmin
                    .from('ranks')
                    .select('id')
                    .eq('name', rankName)
                    .single();

                if (rankData) {
                    rankId = String(rankData.id);
                } else {
                    console.warn(`Rank not found for name: ${rankName}`);
                    // フォールバック: 一般（何もしない、またはエラー？）
                    // システム運用上、シードされているはずですが、なければ rankId=null で進みます（既存の一般扱い）
                    // ただし、rankNameだけは上書きされているのでメールには記載されます。
                }
            } catch (e) {
                console.error('Rank lookup error:', e);
            }
        }

        // 2. 設定取得 (商品マスタ)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from('app_settings')
            .select('*');

        if (settingsError) {
            console.error('Settings lookup error:', settingsError);
            return NextResponse.json({ error: '設定データの取得に失敗しました' }, { status: 500 });
        }

        // 設定データを整形
        const settings: Partial<AppSettings> & {
            email_template?: any,
            email_template_general?: any,
            email_template_free?: any
        } = {};
        settingsData?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
            if (row.key === 'email_template') settings.email_template = row.value;
            if (row.key === 'email_template_general') settings.email_template_general = row.value;
            if (row.key === 'email_template_free') settings.email_template_free = row.value;
        });

        const paymentLinks = settings.payment_links || [];
        // 管理者メールの設定 (DB設定優先、なければ環境変数)
        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // 3. 商品マッチング
        // 条件: 講義会場 AND 懇親会会場 AND 対象属性
        // マッチしない場合は決済リンクなし (手動対応)
        let matchedProduct: PaymentLinkItem | null = null;

        // 一般の場合、rank_idがない商品を探す、または一般用のrank_idがあればそれを使う
        // 現行の実装では rank_id が一致するかを見ている。
        // 一般の人は rankId が null なので、商品マスタの rank_id も null (または undefined) のものとマッチするはず。

        if (Array.isArray(paymentLinks)) {
            // 検索用の会場名（コード→日本語変換を試みる）
            const searchVenue = venueDisplayMap[venue] || venue;
            const searchSocial = venueDisplayMap[social_venue] || social_venue;

            matchedProduct = paymentLinks.find(p => {
                // 講義会場のマッチ: コード一致 または 日本語名一致
                // 商品マスタ側が複数選択("東京・大阪")の場合もあるかもしれないが、完全一致で管理されている前提ならこれでOK
                // もし"東京"が含まれるか？のロジックが必要なら includes を使うが、現状は会場ごとに商品を作っているはず。
                const venueMatch = (p.venue_lecture === venue) ||
                    (p.venue_lecture === searchVenue) ||
                    (venue === 'both' && (p.venue_lecture === '東京・福岡' || p.venue_lecture === '福岡・東京'));

                // 懇親会会場のマッチ
                let socialMatch = (p.venue_social === social_venue) ||
                    (p.venue_social === searchSocial) ||
                    (social_venue === 'both' && (p.venue_social === '東京・福岡' || p.venue_social === '福岡・東京'));

                // オンライン参加の特例: 商品側の懇親会が「ー」ならマッチとみなす
                // (ユーザー入力の social_venue は無視してよい、なぜならオンラインに懇親会はないから)
                if (participation_type === 'online' && p.venue_social === 'ー') {
                    socialMatch = true;
                }

                // ランクのマッチ
                const rankMatch = (rankId ? String(p.rank_id) === rankId : !p.rank_id);

                return venueMatch && socialMatch && rankMatch;
            }) || null;
        }

        const totalAmount = matchedProduct ? (Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)) : 0;
        const paymentUrl = matchedProduct?.url || null;

        const paymentStatus = 'unpaid';

        // 備考欄の作成 (紹介者情報など)
        const tags: string[] = [];
        let remarks = userRemarks ? userRemarks + '\n' : ''; // ユーザー入力の備考を先頭に追加

        if (!matchedProduct) {
            remarks += '【要確認】商品マスタに対象の商品のお申し込みがありません。\n';
        }
        if (!term_id) {
            // 一般参加者のみの備考（必要な場合）または特定のメッセージをスキップするか？
            // 既存のロジックには「紹介者なし」または「未入力」に関するメッセージが含まれていました。
            // 一般参加者向けの特定のメッセージは維持できますが、紹介者が存在する場合、タグロジックは共通であるべきです。
        }

        // 紹介タグロジック（共通）
        if (introducer) {
            remarks += `紹介者: ${introducer}\n`;
            tags.push('ご紹介');
        } else {
            if (!term_id) {
                // 受講生はこのフィールドを持たないことが多いため、一般参加者の場合のみ「なし」または「未入力」を記録します。
                if (no_introducer) {
                    remarks += '紹介者: なし\n';
                } else {
                    remarks += '紹介者: 未入力\n';
                }
            }
        }

        // remarks の末尾の改行を整理（オプション）
        remarks = remarks.trim();

        // attend_social カラムの値を導出
        const attendSocial = (social_venue && social_venue !== 'none' && social_venue !== '参加しない');

        // 4. DBに申込情報を保存
        const { error: insertError } = await supabaseAdmin
            .from('applications')
            .insert({
                input_name: name,
                input_furigana: furigana,
                input_email: email,
                venue,
                social_venue,
                attend_social: attendSocial, // 必須カラムへの値追加
                total_amount: totalAmount,
                payment_status: paymentStatus,
                matched_member_id: memberId,
                applied_rank_name: rankName,

                remarks: remarks || null,
                tags: tags,
                participation_type: participation_type || 'venue',
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
            });

        if (insertError) {
            console.error('Insert application error:', insertError);
            return NextResponse.json({
                error: '申込情報の保存に失敗しました',
                details: insertError.message,
                code: insertError.code,
                hint: insertError.hint
            }, { status: 500 });
        }

        // 5. メール送信
        let displayVenue = venueDisplayMap[venue] || venue;

        // LIVE視聴の場合、備考から会場名を抽出して付記
        // 改行や前後のスペースに強くする
        if (participation_type === 'online') {
            // 例: \n【LIVE視聴会場】東京
            // または他のテキストが混ざっている場合もある
            const match = /【LIVE視聴会場】\s*([^\n]+)/.exec(userRemarks || '');
            if (match) {
                const liveVenue = match[1].trim();
                if (liveVenue) {
                    displayVenue += ` (${liveVenue})`;
                }
            }
        }
        let displaySocialVenue = venueDisplayMap[social_venue] || social_venue;

        // オンライン参加の場合は懇親会を「ー」と表記
        if (participation_type === 'online') {
            displaySocialVenue = 'ー';
        }

        let template;
        // 0円（無料）の場合のテンプレート判定
        // 商品マスタに存在し、かつ金額が0円の場合のみ「無料メール」を送る
        // 商品が存在しない（マッチしない）場合の0円は、事務局確認のため「一般メール」へ
        if (totalAmount === 0 && matchedProduct) {
            const dbTemplate = settings.email_template_free;
            // 0円用テンプレートがあればそれを使う。なければ一般用、あるいはデフォルトにフォールバック
            if (dbTemplate && dbTemplate.subject) {
                template = dbTemplate;
            } else {
                // フォールバック: 一般用を使うか、ここ専用のデフォルトを用意するか
                // 今回は一般用または専用のデフォルト構造へ
                template = {
                    subject: '【神言学】お申込み受付完了のお知らせ',
                    body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n当日は会場にてお待ちしております。`
                };
            }
        } else if (matchedProduct) {
            // DBの設定があっても、subjectがなければデフォルトを使う（空のJSON対策）
            const dbTemplate = settings.email_template;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE;
        } else {
            const dbTemplate = settings.email_template_general;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE_GENERAL;
        }

        const paymentLinkSection = (matchedProduct && paymentUrl) ? paymentUrl : '';

        const vars = {
            name: name,
            rank: rankName,
            venue: displayVenue,
            social_venue: displaySocialVenue,
            amount: totalAmount.toLocaleString(),
            payment_link_section: paymentLinkSection
        };

        const emailSubject = template.subject;
        const emailContent = processEmailTemplate(template.body, vars);

        try {
            const fromEmail = process.env.FROM_EMAIL || 'noreply@resend.dev';
            const apiKey = process.env.RESEND_API_KEY;
            console.log('Attempting to send email:', {
                to: email,
                from: fromEmail,
                hasApiKey: !!apiKey,
                adminEmail,
                adminBccEmail
            });

            // 宛先重複の排除
            // adminEmail (CC) と adminBccEmail (BCC) が同じ場合、BCCからは除外する
            let finalBcc = adminBccEmail ? [adminBccEmail] : undefined;
            if (adminEmail && adminBccEmail && adminEmail.toLowerCase() === adminBccEmail.toLowerCase()) {
                finalBcc = undefined;
            }

            const emailResponse = await resend.emails.send({
                from: `神言学事務局 <${fromEmail}>`,
                to: [email],
                cc: adminEmail ? [adminEmail] : undefined,
                bcc: finalBcc,
                subject: emailSubject,
                text: emailContent,
            });
            console.log('Email sent successfully:', emailResponse);
        } catch (emailError: any) {
            console.error('Email send error:', emailError);
            // デバッグ: 何が起きているか確認するためにクライアントにエラーを返します
            return NextResponse.json({
                success: true,
                message: 'Application received but email failed',
                email_error: emailError.message,
                email_error_full: JSON.stringify(emailError, Object.getOwnPropertyNames(emailError))
            });
        }

        return NextResponse.json({ success: true, message: 'Application received', email_sent: true });

    } catch (e) {
        console.error('Unexpected error:', e);
        return NextResponse.json({ error: '予期せぬエラーが発生しました' }, { status: 500 });
    }
}
