import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { processEmailTemplate, DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_TEMPLATE_GENERAL, DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION, DEFAULT_EMAIL_TEMPLATE_MULTIPLE } from '@/lib/emailTemplate';
import { normalizeVenue, getVenueDisplayName, matchProduct } from '@/lib/venueUtils';
import { normalizeName } from '@/lib/kanjiNormalizeServer';

// 型定義
interface ApplyRequest {
    name: string;
    furigana: string;
    email: string;
    venue: string;
    social_venue: string;
    term_id?: string;
    introducer?: string;
    no_introducer?: boolean;
    participation_type?: string;
    online_venues?: string;
    remarks?: string;
    is_multiple?: boolean;
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

export async function POST(request: Request) {
    try {
    const body: ApplyRequest = await request.json();
    let { name, furigana, email, venue, social_venue, term_id, introducer, no_introducer, participation_type, online_venues, remarks: userRemarks, is_multiple } = body;

        // 漢字マッピングの取得
        const { data: kanjiSetting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'kanji_mapping')
            .single();
        const customKanjiMap = kanjiSetting?.value || undefined;

        // 0. データの正規化
        // 会場名を日本語名に正規化
        venue = normalizeVenue(venue);
        social_venue = normalizeVenue(social_venue);

        const originalName = name ? name.trim() : ''; // 入力時の漢字を保持
        const normalizedInputName = normalizeName(originalName, customKanjiMap); // 照合用の正規化名
        
        if (email) {
            email = email.trim().toLowerCase();
        }

        // 基本バリデーション
        if (!originalName || !furigana || !email || !venue) {
            return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
        }

        // 重複申し込みチェック
        // 同じメールアドレスの既存申込を取得
        const { data: existingData, error: duplicateError } = await supabaseAdmin
            .from('applications')
            .select('id, input_name')
            .eq('input_email', email);

        if (duplicateError) {
            console.error('Duplicate check error:', duplicateError);
            return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
        }

        // 取得したレコードの氏名を正規化して比較（表記ゆれがあっても重複として検出）
        const isDuplicate = existingData?.some(app => normalizeName(app.input_name, customKanjiMap) === normalizedInputName);
        if (isDuplicate) {
            return NextResponse.json({ error: 'すでにお申し込みがあります' }, { status: 400 });
        }

        let rankName = '一般';
        let memberId = null;
        let rankId = null;

        // 1. Membersマスタと照合 (受講生の場合のみ)
        if (term_id) {
            const { data: allMembers, error: memberError } = await supabaseAdmin
                .from('members')
                .select('*, ranks(id, name)')
                .eq('term_id', term_id);

            if (memberError) {
                console.error('Member lookup error:', memberError);
                return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
            }

            // 同名・同期が複数いる場合、特進（is_tokushin=true）を優先して照合する
            const normalizedInputFurigana = normalizeName(furigana, customKanjiMap);
            
            const matchedMembers = allMembers?.filter(m => {
                const isNameMatch = normalizeName(m.name, customKanjiMap) === normalizedInputName;
                const isFuriganaMatch = m.furigana && normalizeName(m.furigana, customKanjiMap) === normalizedInputFurigana;
                return isNameMatch || isFuriganaMatch;
            }) || [];

            const member = matchedMembers.find(m => m.is_tokushin) || matchedMembers[0] || null;

            if (member) {
                rankId = member.ranks?.id ? String(member.ranks.id) : null;
                rankName = member.ranks?.name || '受講生(属性未設定)'; // マスタに名前があればそれを使用
                memberId = member.id;
            } else {
                // 受講生として申し込んだがマスタに存在しない場合、一般への格下げを防ぐ
                rankName = '確認中（受講生一致エラー）';
            }
        } else {
            // 一般（マスタ外）の場合
            if (introducer) {
                rankName = '神言学未受講（ご紹介）';
            } else {
                rankName = '神言学未受講（一般）';
            }

            try {
                const { data: rankData } = await supabaseAdmin
                    .from('ranks')
                    .select('id')
                    .eq('name', rankName)
                    .single();

                if (rankData) {
                    rankId = String(rankData.id);
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

        const settings: any = {};
        settingsData?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
            if (row.key === 'email_template') settings.email_template = row.value;
            if (row.key === 'email_template_general') settings.email_template_general = row.value;
            if (row.key === 'email_template_free') settings.email_template_free = row.value;
            if (row.key === 'email_template_free_online') settings.email_template_free_online = row.value;
            if (row.key === 'email_template_multiple') settings.email_template_multiple = row.value;
            if (row.key === 'sender_name') settings.sender_name = row.value;
            if (row.key === 'sender_email') settings.sender_email = row.value;
        });

        const paymentLinks = settings.payment_links || [];
        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // --- デバッグログ: マッチング前 ---
        console.log(`[API/apply] マッチング実行中...`, {
            email,
            rank: { id: rankId, name: rankName },
            participation: { type: participation_type, venues: online_venues || venue },
            linksCount: paymentLinks.length
        });

        // 3. 商品マッチング (共通ユーティリティを使用)
        const matchedProduct = matchProduct(paymentLinks, {
            venue,
            social_venue: social_venue || 'ー',
            participation_type: participation_type || 'venue',
            online_venues,
            rank_id: rankId,
            rank_name: rankName
        });

        if (matchedProduct) {
            console.log(`[API/apply] マッチ成功: ${matchedProduct.name} (Price: ${Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)})`);
        } else {
            console.error(`[API/apply] マッチ失敗: 適切な商品が見つかりませんでした。`);
        }

        const totalAmount = matchedProduct ? (Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)) : 0;
        const paymentUrl = matchedProduct?.url || null;
        const paymentStatus = (matchedProduct && totalAmount === 0) ? 'paid' : 'unpaid';

        // 備考欄の作成
        const tags: string[] = [];
        let remarks = userRemarks ? userRemarks + '\n' : '';

        if (is_multiple) {
            tags.push('複数名');
            if (!remarks.includes('【複数名申込み希望】')) {
                remarks = '【複数名申込み希望】\n' + remarks;
            }
        }

        if (venue === '参加しない') {
            tags.push('不参加');
        } else if (!matchedProduct) {
            remarks += '【要確認】商品マスタに対象の商品のお申し込みがありません。\n';
        }

        if (introducer) {
            remarks += `紹介者: ${introducer}\n`;
            tags.push('ご紹介');
        } else if (!term_id) {
            if (no_introducer) {
                remarks += '紹介者: なし\n';
            } else {
                remarks += '紹介者: 未入力\n';
            }
        }

        remarks = remarks.trim();
        const attendSocial = (social_venue && social_venue !== '参加しない');

        // 4. DBに申込情報を保存
        const { error: insertError } = await supabaseAdmin
            .from('applications')
            .insert({
                input_name: originalName,
                input_furigana: furigana,
                input_email: email,
                venue,
                social_venue,
                attend_social: attendSocial,
                total_amount: totalAmount,
                payment_status: paymentStatus,
                matched_member_id: memberId,
                applied_rank_name: rankName,
                remarks: remarks || null,
                tags: tags,
                participation_type: participation_type || 'venue',
                online_venues: online_venues || null,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
            });

        if (insertError) {
            console.error('Insert application error:', insertError);
            return NextResponse.json({ error: '申込情報の保存に失敗しました' }, { status: 500 });
        }

        // 5. メール送信用の表示名作成
        let displayVenue = getVenueDisplayName(venue, participation_type, online_venues);
        let displaySocialVenue = (participation_type === 'online') ? '参加不可' : social_venue;

        // 個別金額の付加
        if (matchedProduct) {
            const lectureFee = Number(matchedProduct.lecture_fee) || 0;
            displayVenue += `（${lectureFee.toLocaleString()}円）`;
            const socialFee = Number(matchedProduct.social_fee) || 0;
            if (participation_type !== 'online' && social_venue !== '参加しない') {
                displaySocialVenue += `（${socialFee.toLocaleString()}円）`;
            }
        } else {
            if (venue === '参加しない') displayVenue += `（0円）`;
            if (social_venue === '参加しない' && participation_type !== 'online') displaySocialVenue += `（0円）`;
        }

        let template;
        if (is_multiple) {
            const dbTemplate = settings.email_template_multiple;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE_MULTIPLE;
        } else if (venue === '参加しない') {
            template = DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION;
        } else if (totalAmount === 0 && matchedProduct) {
            const dbTemplateVenue = settings.email_template_free;
            const dbTemplateOnline = settings.email_template_free_online;
            let dbTemplate = (participation_type === 'online' && dbTemplateOnline?.subject) ? dbTemplateOnline : dbTemplateVenue;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : {
                subject: '【神言学】お申込み受付完了のお知らせ',
                body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n当日は会場にてお待ちしております。`
            };
        } else if (matchedProduct) {
            const dbTemplate = settings.email_template;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE;
        } else {
            const dbTemplate = settings.email_template_general;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE_GENERAL;
        }

        const vars = {
            name: originalName,
            rank: rankName,
            venue: displayVenue,
            social_venue: displaySocialVenue,
            amount: is_multiple ? '（事務局にて算出後、別途ご連絡）' : totalAmount.toLocaleString(),
            payment_link_section: (!is_multiple && matchedProduct && paymentUrl && totalAmount > 0) ? paymentUrl : ''
        };

        const emailSubject = template.subject;
        const emailContent = processEmailTemplate(template.body, vars);

        try {
            const fromEmail = settings.sender_email || process.env.FROM_EMAIL || 'noreply@resend.dev';
            const fromName = settings.sender_name || '神言学事務局';
            let finalBcc = adminBccEmail ? [adminBccEmail] : undefined;
            if (adminEmail && adminBccEmail && adminEmail.toLowerCase() === adminBccEmail.toLowerCase()) {
                finalBcc = undefined;
            }

            await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: [email],
                cc: adminEmail ? [adminEmail] : undefined,
                bcc: finalBcc,
                subject: emailSubject,
                text: emailContent,
            });
        } catch (emailError: any) {
            console.error('Email send error:', emailError);
            return NextResponse.json({ success: true, message: 'Application received but email failed' });
        }

        return NextResponse.json({ success: true, message: 'Application received', email_sent: true });

    } catch (e) {
        console.error('Unexpected error:', e);
        return NextResponse.json({ error: '予期せぬエラーが発生しました' }, { status: 500 });
    }
}
