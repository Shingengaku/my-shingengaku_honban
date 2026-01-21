
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const results: any = {
        checks: {},
        email_attempt: null
    };

    // 1. Check API Key presence
    const apiKey = process.env.RESEND_API_KEY;
    results.checks.resend_api_key_configured = !!apiKey;
    results.checks.resend_api_key_prefix = apiKey ? apiKey.substring(0, 3) : 'NONE';

    // 2. Check From Email
    const fromEmail = process.env.FROM_EMAIL;
    results.checks.from_email = fromEmail || 'MISSING (Defaults to noreply@resend.dev)';

    // 3. Check DB Settings (Admin Email)
    try {
        const { data: settings } = await supabaseAdmin.from('app_settings').select('*');
        const adminEmailSetting = settings?.find(s => s.key === 'admin_email');
        const adminBccSetting = settings?.find(s => s.key === 'admin_bcc_email');

        results.checks.db_admin_email = adminEmailSetting?.value;
        results.checks.db_admin_bcc = adminBccSetting?.value;
    } catch (e: any) {
        results.checks.db_error = e.message;
    }

    // 4. Attempt Validation Send
    if (apiKey) {
        const resend = new Resend(apiKey);
        try {
            const sender = fromEmail || 'noreply@resend.dev';
            const { data, error } = await resend.emails.send({
                from: `Debug Test <${sender}>`,
                to: ['delivered@resend.dev'], // Always succeeds if config is correct
                subject: 'Debug Route Test',
                html: '<p>If you see this, basic sending works.</p>'
            });

            if (error) {
                results.email_attempt = { success: false, error };
            } else {
                results.email_attempt = { success: true, data };
            }
        } catch (e: any) {
            results.email_attempt = { success: false, error_thrown: e.message };
        }
    } else {
        results.email_attempt = { success: false, error: 'No API Key' };
    }

    return NextResponse.json(results, { status: 200 });
}
