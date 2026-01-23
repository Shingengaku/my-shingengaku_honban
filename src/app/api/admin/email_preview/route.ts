import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPaymentKey } from '@/lib/payment';
import { DEFAULT_EMAIL_TEMPLATE, processEmailTemplate } from '@/lib/emailTemplate';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        // 1. 申込データを取得
        const { data: app, error } = await supabaseAdmin
            .from('applications')
            .select('*, members(*)')
            .eq('id', id)
            .single();

        if (error || !app) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }


        // 2. 設定を取得 (決済リンク & メールテンプレート用)
        const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*');
        const paymentLinks = settingsData?.find(r => r.key === 'payment_links')?.value || {};
        const emailTemplate = settingsData?.find(r => r.key === 'email_template')?.value || DEFAULT_EMAIL_TEMPLATE;

        const totalAmount: number = app.total_amount;
        const name = app.input_name;
        // @ts-ignore
        const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
        // @ts-ignore
        const venue = app.venue;
        // @ts-ignore
        const social_venue = app.social_venue || 'none';

        // 3. 支払いリンク情報
        let paymentLink = null;
        if (Array.isArray(paymentLinks)) {
            paymentLink = paymentLinks.find((p: any) =>
                (Number(p.lecture_fee) + Number(p.social_fee)) === app.total_amount &&
                p.venue_lecture === app.venue &&
                p.venue_social === app.social_venue
            );
        }

        const paymentUrl = paymentLink?.url || null;

        // 3. メール内容の構築
        const venueStr = venue === 'both' ? '東京・福岡 両会場' : (venue === 'tokyo' ? '東京会場' : '福岡会場');
        const socialVenueStr = social_venue === 'none' ? '参加しない' : (social_venue === 'both' ? '両方参加' : (social_venue === 'tokyo' ? '東京のみ参加' : '福岡のみ参加'));

        let paymentLinkSection = '';
        if (paymentUrl) {
            paymentLinkSection = `引き続き、以下のリンクより決済のお手続きをお願いいたします。\n\n▼ 決済リンク\n${paymentUrl}`;
        } else {
            paymentLinkSection = `本お申込みの費用は発生しません（または当日支払いです）。\n当日会場でお待ちしております。`;
        }

        const content = processEmailTemplate(emailTemplate.body, {
            name,
            rank: rankName,
            venue: venueStr,
            social_venue: socialVenueStr,
            amount: totalAmount.toLocaleString(),
            payment_link_section: paymentLinkSection
        });

        const adminEmail = settingsData?.find(r => r.key === 'admin_email')?.value || null;

        const adminBccEmail = settingsData?.find(r => r.key === 'admin_bcc_email')?.value || null;

        // 管理者とアプリ固有のCC/BCCをマージ
        // 新ロジック: 個別設定がグローバル設定を上書きします。マージはしません。
        // app.cc_email が NULL でない場合、それを使用します（空文字列の場合も含む）。
        // app.cc_email が NULL の場合、adminEmail にフォールバックします。
        const ccList = app.cc_email !== null ? app.cc_email : adminEmail;
        const bccList = app.bcc_email !== null ? app.bcc_email : adminBccEmail;

        return NextResponse.json({
            subject: emailTemplate.subject,
            content,
            email: app.input_email,
            cc: ccList || undefined,
            bcc: bccList || undefined
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
