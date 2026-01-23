
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { resend } from '@/lib/resend';
import { processEmailTemplate, DEFAULT_EMAIL_TEMPLATE_FORGOT_PASS } from '@/lib/emailTemplate';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
        }

        // ユーザーを確認
        const { data: user } = await supabaseAdmin
            .from('admin_users')
            .select('id, username')
            .eq('email', email)
            .single();

        if (!user) {
            // セキュリティ: ユーザーが存在するかどうかを明かしませんが、この管理システムでは親切なエラーでも問題ないでしょうか?
            // "メールアドレスが登録されている場合、リンクを送信しました。" が標準です。
            return NextResponse.json({ success: true, message: 'メールを送信しました（登録がない場合は届きません）' });
        }

        // トークン生成
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

        // トークン保存
        const { error: updateError } = await supabaseAdmin
            .from('admin_users')
            .update({
                reset_token: token,
                reset_token_expires: expires.toISOString()
            })
            .eq('id', user.id);

        if (updateError) {
            console.error(updateError);
            return NextResponse.json({ error: 'トークンの保存に失敗しました' }, { status: 500 });
        }

        // メール送信
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const resetLink = `${origin}/admin/reset-password?token=${token}`;

        // テンプレート取得
        const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*');
        const template = settingsData?.find(r => r.key === 'email_template_forgot_pass')?.value || DEFAULT_EMAIL_TEMPLATE_FORGOT_PASS;

        const vars = {
            username: user.username,
            reset_link: resetLink
        };

        const emailSubject = template.subject;
        const emailContent = processEmailTemplate(template.body, vars);

        if (process.env.RESEND_API_KEY) {
            const fromEmail = process.env.FROM_EMAIL || 'noreply@resend.dev';
            await resend.emails.send({
                from: `神言学システム <${fromEmail}>`,
                to: email,
                subject: emailSubject,
                text: emailContent,
            });
        }

        return NextResponse.json({ success: true, message: 'メールを送信しました' });

    } catch (e) {
        console.error('Forgot Password Error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
