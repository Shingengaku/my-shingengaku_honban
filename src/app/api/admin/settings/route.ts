
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
                supabaseAdmin.from('app_settings').upsert({ key: 'social_fees', value: body.social_fees })
            );
        }
        if (body.payment_links) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'payment_links', value: body.payment_links })
            );
        }
        if (body.email_template) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template', value: body.email_template })
            );
        }
        if (body.email_template_general) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_general', value: body.email_template_general })
            );
        }
        if (body.email_template_resend) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_resend', value: body.email_template_resend })
            );
        }
        if (body.email_template_forgot_pass) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'email_template_forgot_pass', value: body.email_template_forgot_pass })
            );
        }
        if (body.product_name_master) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'product_name_master', value: body.product_name_master })
            );
        }
        if (body.term_master) {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'term_master', value: body.term_master })
            );
        }
        if (typeof body.url_prefix !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'url_prefix', value: body.url_prefix })
            );
        }
        if (typeof body.url_suffix !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'url_suffix', value: body.url_suffix })
            );
        }
        if (typeof body.admin_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'admin_email', value: body.admin_email })
            );
        }
        if (typeof body.admin_bcc_email !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'admin_bcc_email', value: body.admin_bcc_email })
            );
        }
        if (typeof body.application_text !== 'undefined') {
            updates.push(
                supabaseAdmin.from('app_settings').upsert({ key: 'application_text', value: body.application_text })
            );
        }


        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
