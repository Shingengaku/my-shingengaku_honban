
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { processEmailTemplate, DEFAULT_EMAIL_TEMPLATE_RESEND } from '@/lib/emailTemplate';

export async function POST(request: Request) {
    try {
        const { id, subject: customSubject, body: customBody } = await request.json();

        // 1. 申込データ取得
        const { data: app, error } = await supabaseAdmin
            .from('applications')
            .select('*, members(*)')
            .eq('id', id)
            .single();

        if (error || !app) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }

        // 2. 設定取得
        const { data: settingsData } = await supabaseAdmin
            .from('app_settings')
            .select('*');

        const settings: any = {};
        settingsData?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
            if (row.key === 'email_template_resend') settings.email_template_resend = row.value;
        });

        const paymentLinks = settings.payment_links || [];
        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // 3. 支払いリンク情報
        let paymentLink = null;
        if (Array.isArray(paymentLinks)) {
            paymentLink = paymentLinks.find((p: any) =>
                (Number(p.lecture_fee) + Number(p.social_fee)) === app.total_amount &&
                p.venue_lecture === app.venue &&
                p.venue_social === app.social_venue
            );
        }

        const paymentUrl = paymentLink?.url || '';

        // テンプレート選択
        const template = settings.email_template_resend || DEFAULT_EMAIL_TEMPLATE_RESEND;

        const venueDisplayMap: Record<string, string> = {
            'tokyo': '東京',
            'fukuoka': '福岡',
            'both': '両方参加',
            'none': '参加しません'
        };

        const displayVenue = venueDisplayMap[app.venue] || app.venue;
        const displaySocialVenue = venueDisplayMap[app.social_venue] || app.social_venue;

        // 修正: 案内文と合計金額を削除し、URLのみにする
        const paymentLinkSection = paymentUrl ? paymentUrl : '';

        const vars = {
            name: app.input_name,
            rank: app.applied_rank_name || '一般',
            venue: displayVenue,
            social_venue: displaySocialVenue,
            amount: app.total_amount.toLocaleString(),
            payment_link_section: paymentLinkSection
        };

        const emailSubject = customSubject || template.subject;
        const emailContent = customBody || processEmailTemplate(template.body, vars);

        // CC/BCC ロジック
        // app.cc_email が null の場合は adminEmail を使用 (未設定なら undefined)
        const effectiveCC = app.cc_email !== null ? app.cc_email : adminEmail;
        const effectiveBCC = app.bcc_email !== null ? app.bcc_email : adminBccEmail;

        const cc = [effectiveCC].filter(Boolean);
        const bcc = [effectiveBCC].filter(Boolean);

        const fromEmail = process.env.FROM_EMAIL || 'noreply@resend.dev';
        await resend.emails.send({
            from: `神言学事務局 <${fromEmail}>`,
            to: [app.input_email],
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
