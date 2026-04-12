
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    const { data, error } = await supabaseAdmin.from('app_settings').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 配列をオブジェクトに変換
    const settings: any = {};
    data?.forEach(row => {
        settings[row.key] = row.value;
    });

    return NextResponse.json(settings);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // body: { social_fees: {...}, payment_links: {...} }

        const updates = [];
        if (body.social_fees) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'social_fees', value: body.social_fees }, { onConflict: 'key' })
            );
        }
        if (body.payment_links) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'payment_links', value: body.payment_links }, { onConflict: 'key' })
            );
        }
        if (body.email_template) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template', value: body.email_template }, { onConflict: 'key' })
            );
        }
        if (body.email_template_general) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_general', value: body.email_template_general }, { onConflict: 'key' })
            );
        }
        if (body.email_template_resend) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_resend', value: body.email_template_resend }, { onConflict: 'key' })
            );
        }
        if (body.email_template_free) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_free', value: body.email_template_free }, { onConflict: 'key' })
            );
        }
        if (body.email_template_free_online) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_free_online', value: body.email_template_free_online }, { onConflict: 'key' })
            );
        }
        if (body.email_template_forgot_pass) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_forgot_pass', value: body.email_template_forgot_pass }, { onConflict: 'key' })
            );
        }
        if (body.product_name_master) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'product_name_master', value: body.product_name_master }, { onConflict: 'key' })
            );
        }
        if (body.term_master) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'term_master', value: body.term_master }, { onConflict: 'key' })
            );
        }
        if (typeof body.url_prefix !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'url_prefix', value: body.url_prefix }, { onConflict: 'key' })
            );
        }
        if (typeof body.url_suffix !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'url_suffix', value: body.url_suffix }, { onConflict: 'key' })
            );
        }
        if (typeof body.admin_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'admin_email', value: body.admin_email }, { onConflict: 'key' })
            );
        }
        if (typeof body.admin_bcc_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'admin_bcc_email', value: body.admin_bcc_email }, { onConflict: 'key' })
            );
        }
        if (typeof body.test_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'test_email', value: body.test_email }, { onConflict: 'key' })
            );
        }
        if (typeof body.application_text !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'application_text', value: body.application_text }, { onConflict: 'key' })
            );
        }
        if (typeof body.application_active !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'application_active', value: body.application_active }, { onConflict: 'key' })
            );
        }
        if (typeof body.application_title !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'application_title', value: body.application_title }, { onConflict: 'key' })
            );
        }
        if (typeof body.application_title_size !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'application_title_size', value: body.application_title_size }, { onConflict: 'key' })
            );
        }
        if (typeof body.base_social_fee_tokyo !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'base_social_fee_tokyo', value: body.base_social_fee_tokyo }, { onConflict: 'key' })
            );
        }
        if (typeof body.base_social_fee_fukuoka !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'base_social_fee_fukuoka', value: body.base_social_fee_fukuoka }, { onConflict: 'key' })
            );
        }
        if (typeof body.tax_rate_lecture !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'tax_rate_lecture', value: body.tax_rate_lecture }, { onConflict: 'key' })
            );
        }
        if (typeof body.tax_rate_social !== undefined) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'tax_rate_social', value: body.tax_rate_social }, { onConflict: 'key' })
            );
        }
        if (typeof body.sender_name !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'sender_name', value: body.sender_name }, { onConflict: 'key' })
            );
        }
        if (typeof body.sender_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'sender_email', value: body.sender_email }, { onConflict: 'key' })
            );
        }
        if (body.email_template_reminder_venue_paid) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_reminder_venue_paid', value: body.email_template_reminder_venue_paid }, { onConflict: 'key' })
            );
        }
        if (body.email_template_reminder_venue_unpaid) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_reminder_venue_unpaid', value: body.email_template_reminder_venue_unpaid }, { onConflict: 'key' })
            );
        }
        if (body.email_template_reminder_online_paid) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_reminder_online_paid', value: body.email_template_reminder_online_paid }, { onConflict: 'key' })
            );
        }
        if (body.email_template_reminder_online_unpaid) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_reminder_online_unpaid', value: body.email_template_reminder_online_unpaid }, { onConflict: 'key' })
            );
        }
        if (body.online_viewing_links) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'online_viewing_links', value: body.online_viewing_links }, { onConflict: 'key' })
            );
        }
        if (body.lecture_dates) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'lecture_dates', value: body.lecture_dates }, { onConflict: 'key' })
            );
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
