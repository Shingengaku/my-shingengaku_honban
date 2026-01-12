
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { getPaymentKey } from '@/lib/payment';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        // 1. Get Application Data
        const { data: app, error } = await supabaseAdmin
            .from('applications')
            .select('*, members(*)')
            .eq('id', id)
            .single();

        if (error || !app) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }

        // 2. Get Settings (for payment links)
        const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*');
        const paymentLinks = settingsData?.find(r => r.key === 'payment_links')?.value || {};

        const totalAmount: number = app.total_amount;
        const name = app.input_name;
        const email = app.input_email;
        const rankName = app.applied_rank_name;
        // @ts-ignore
        const venue = app.venue;
        // @ts-ignore
        const social_venue = app.social_venue || 'none'; // Fallback

        const paymentKey = getPaymentKey(rankName, venue, social_venue);
        const linkKeyAmount = totalAmount.toString();
        const paymentLink = paymentLinks[paymentKey] ?? paymentLinks[linkKeyAmount] ?? paymentLinks['default'] ?? null;

        // 3. Construct Email
        const emailSubject = paymentLink
            ? '【神言学】【再送】お申込み受付・決済のご案内'
            : '【神言学】【再送】お申込み完了のお知らせ';

        let emailContent = `
${name} 様

(本メールは管理者による再送です)

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: ${name}
判定属性: ${rankName}
参加会場: ${venue === 'both' ? '東京・福岡 両会場' : (venue === 'tokyo' ? '東京会場' : '福岡会場')}
懇親会: ${social_venue === 'none' ? '参加しない' : (social_venue === 'both' ? '両方参加' : (social_venue === 'tokyo' ? '東京のみ参加' : '福岡のみ参加'))}
合計金額: ${totalAmount.toLocaleString()} 円
--------------------------------
`;

        if (paymentLink && totalAmount > 0) {
            emailContent += `

引き続き、以下のリンクより決済のお手続きをお願いいたします。

▼ 決済リンク
${paymentLink}
`;
        } else {
            emailContent += `

本お申込みの費用は発生しません（または当日支払いです）。
当日会場でお待ちしております。
`;
        }

        const adminEmail = settingsData?.find(r => r.key === 'admin_email')?.value || null;
        const adminBccEmail = settingsData?.find(r => r.key === 'admin_bcc_email')?.value || null;

        // Override logic: Use App Individual if NOT NULL, else default to Global
        const effectiveCC = app.cc_email !== null ? app.cc_email : adminEmail;
        const effectiveBCC = app.bcc_email !== null ? app.bcc_email : adminBccEmail;

        const cc = [effectiveCC].filter(Boolean);
        const bcc = [effectiveBCC].filter(Boolean);

        await resend.emails.send({
            from: '神言学事務局 <noreply@resend.dev>',
            to: [email],
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            subject: emailSubject,
            text: emailContent,
        });

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
