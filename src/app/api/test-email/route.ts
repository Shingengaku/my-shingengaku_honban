
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
    const fromEmailEnv = process.env.FROM_EMAIL;
    results.checks.from_email_env = fromEmailEnv || 'MISSING';

    try {
        // 3. Fetch Settings (Exact logic from apply/route.ts)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from('app_settings')
            .select('*');

        if (settingsError) {
            results.checks.db_error = settingsError;
            throw new Error(`DB Error: ${settingsError.message}`);
        }

        const settings: any = {};
        settingsData?.forEach(row => {
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
        });

        const adminEmail = settings.admin_email;
        const adminBccEmail = settings.admin_bcc_email;

        results.checks.db_admin_email = adminEmail || 'NULL';
        results.checks.db_admin_bcc = adminBccEmail || 'NULL';

        // 4. Attempt Validation Send (Mirroring apply/route.ts)
        if (apiKey) {
            const resend = new Resend(apiKey);
            const senderEmail = fromEmailEnv || 'noreply@resend.dev';

            // EXACT FORMAT used in production
            const fromHeader = `神言学事務局 <${senderEmail}>`;

            results.checks.final_from_header = fromHeader;

            const { data, error } = await resend.emails.send({
                from: fromHeader,
                to: ['t.matsumoto@f-o-dreams.com'], // Targeted test
                cc: adminEmail ? [adminEmail] : undefined,
                bcc: adminBccEmail ? [adminBccEmail] : undefined,
                subject: '【テスト】神言学システムメール到達確認',
                html: `<p>このメールが届けば、システムからの送信は正常です。</p><p>宛先: t.matsumoto@f-o-dreams.com</p><p>From: ${fromHeader}</p>`
            });

            if (error) {
                results.email_attempt = { success: false, error };
            } else {
                results.email_attempt = { success: true, data };
            }
        } else {
            results.email_attempt = { success: false, error: 'No API Key' };
        }

    } catch (e: any) {
        results.email_attempt = { success: false, error_thrown: e.message, stack: e.stack };
    }


    // 5. (Optional) Check Status of specific Email ID
    const url = new URL(request.url);
    const checkId = url.searchParams.get('check_email_id');

    if (checkId && apiKey) {
        const resend = new Resend(apiKey);
        try {
            // Get email details to see status (delivered, bounced, etc.)
            const emailStatus = await resend.emails.get(checkId);
            results.check_id_status = emailStatus;
        } catch (e: any) {
            results.check_id_status = { error: e.message };
        }
    }

    return NextResponse.json(results, { status: 200 });
}
