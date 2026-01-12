import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';

// 型定義
interface ApplyRequest {
    name: string;
    furigana: string;
    email: string;
    venue: string; // 'tokyo', 'fukuoka',, 'both', 'none'
    social_venue: string; // 'none', 'tokyo', 'fukuoka', 'both'
    term_id: string; // Added validation logic
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
        let { name, furigana, email, venue, social_venue } = body;

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

        // 1. Membersマスタと照合 (属性ID取得)
        // 条件: 名前 (スペース無視) AND 期 (term_id)
        const { data: allMembers, error: memberError } = await supabaseAdmin
            .from('members')
            .select('*, ranks(id, name)')
            .eq('term_id', body.term_id); // term_idで絞り込み

        if (memberError) {
            console.error('Member lookup error:', memberError);
            return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
        }

        const normalizedInputName = name.replace(/\s+/g, '');

        // 名前でマッチング
        const member = allMembers?.find(m =>
            m.name.replace(/\s+/g, '') === normalizedInputName
        ) || null;

        const rankId = member?.ranks?.id ? String(member.ranks.id) : null;
        const rankName = member?.ranks?.name || '一般'; // Fallback for display
        const memberId = member?.id || null;

        // 2. 設定取得 (商品マスタ)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from('app_settings')
            .select('*');

        if (settingsError) {
            console.error('Settings lookup error:', settingsError);
            return NextResponse.json({ error: '設定データの取得に失敗しました' }, { status: 500 });
        }

        // 設定データを整形
        const settings: Partial<AppSettings> = {};
        settingsData?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
        });

        const paymentLinks = settings.payment_links || [];
        const adminEmail = settings.admin_email;
        const adminBccEmail = settings.admin_bcc_email;

        // 3. 商品マッチング
        // 条件: 講義会場 AND 懇親会会場 AND 対象属性
        // マッチしない場合は決済リンクなし (manual_handling)
        let matchedProduct: PaymentLinkItem | null = null;

        if (Array.isArray(paymentLinks)) {
            matchedProduct = paymentLinks.find(p =>
                p.venue_lecture === venue &&
                p.venue_social === social_venue &&
                (rankId ? String(p.rank_id) === rankId : false) // Assuming Product has rank_id
            ) || null;
        }

        const totalAmount = matchedProduct ? (Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)) : 0;
        const paymentUrl = matchedProduct?.url || null;
        // const productName = matchedProduct?.name || '未定義'; // For manual handling display // unused

        const paymentStatus = 'unpaid'; // DB constraint likely requires 'unpaid', 'paid', or 'cancelled'. 'manual_handling' is logical but not schema-compliant.

        // 4. DBに申込情報を保存
        const { error: insertError } = await supabaseAdmin
            .from('applications')
            .insert({
                input_name: name,
                input_furigana: furigana,
                input_email: email,
                venue,
                attend_social: social_venue !== 'none',
                social_venue,
                total_amount: totalAmount,
                payment_status: paymentStatus,
                matched_member_id: memberId,
                applied_rank_name: rankName, // logging purposes
                remarks: !matchedProduct ? '【要確認】商品マスタに対象の商品のお申し込みがありません。' : null
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
        const emailSubject = matchedProduct
            ? '【神言学】お申込み受付・決済のご案内'
            : '【神言学】お申込み受付のお知らせ';

        const displayVenue = venueDisplayMap[venue] || venue;
        const displaySocialVenue = venueDisplayMap[social_venue] || social_venue;

        let emailContent = `
${name} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: ${name}
判定属性: ${rankName}
参加会場: ${displayVenue}
懇親会: ${displaySocialVenue}
--------------------------------
`;

        if (matchedProduct && paymentUrl) {
            emailContent += `
合計金額: ${totalAmount.toLocaleString()} 円

引き続き、以下のリンクより決済のお手続きをお願いいたします。

▼ 決済リンク
${paymentUrl}
`;
        } else {
            emailContent += `

現在、お客様の条件に合致する自動決済案内が見つかりませんでした（または事務局確認が必要です）。
事務局より別途、正式なご案内メールをお送りいたしますので、今しばらくお待ちください。
`;
        }

        try {
            await resend.emails.send({
                from: '神言学事務局 <noreply@resend.dev>',
                to: [email],
                cc: adminEmail ? [adminEmail] : undefined,
                bcc: adminBccEmail ? [adminBccEmail] : undefined,
                subject: emailSubject,
                text: emailContent,
            });
        } catch (emailError) {
            console.error('Email send error:', emailError);
        }

        return NextResponse.json({ success: true, message: 'Application received' });

    } catch (e) {
        console.error('Unexpected error:', e);
        return NextResponse.json({ error: '予期せぬエラーが発生しました' }, { status: 500 });
    }
}
