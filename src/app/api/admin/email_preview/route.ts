import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPaymentKey } from '@/lib/payment';
import { DEFAULT_EMAIL_TEMPLATE, processEmailTemplate } from '@/lib/emailTemplate';

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


        // 2. Get Settings (for payment links & email template)
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

        const paymentKey = getPaymentKey(rankName, venue, social_venue);
        const linkKeyAmount = totalAmount.toString();
        const paymentLink = paymentLinks[paymentKey] ?? paymentLinks[linkKeyAmount] ?? paymentLinks['default'] ?? null;

        // 3. Construct Email Content
        const venueStr = venue === 'both' ? '東京・福岡 両会場' : (venue === 'tokyo' ? '東京会場' : '福岡会場');
        const socialVenueStr = social_venue === 'none' ? '参加しない' : (social_venue === 'both' ? '両方参加' : (social_venue === 'tokyo' ? '東京のみ参加' : '福岡のみ参加'));

        let paymentLinkSection = '';
        if (paymentLink && totalAmount > 0) {
            paymentLinkSection = `引き続き、以下のリンクより決済のお手続きをお願いいたします。\n\n▼ 決済リンク\n${paymentLink}`;
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

        // Merge Admin and App-specific CC/BCC
        // NEW LOGIC: Individual setting overrides Global. No merging.
        // If app.cc_email is NOT NULL, use it (even if empty string).
        // If app.cc_email IS NULL, fall back to adminEmail.
        const ccList = app.cc_email !== null ? app.cc_email : adminEmail;
        const bccList = app.bcc_email !== null ? app.bcc_email : adminBccEmail;

        return NextResponse.json({
            subject: emailTemplate.subject,
            content,
            paymentKey,
            email: app.input_email,
            cc: ccList || undefined,
            bcc: bccList || undefined
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
