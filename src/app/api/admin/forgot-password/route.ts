
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
        }

        // Check user
        const { data: user } = await supabaseAdmin
            .from('admin_users')
            .select('id, username')
            .eq('email', email)
            .single();

        if (!user) {
            // Security: Don't reveal if user exists, but for this admin system, friendly error might be okay?
            // "If the email is registered, we sent a link." is standard.
            return NextResponse.json({ success: true, message: 'メールを送信しました（登録がない場合は届きません）' });
        }

        // Generate Token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

        // Save Token
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

        // Send Email
        // Assuming localhost:3000 for now, but should ideally use headers or env for base URL.
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const resetLink = `${origin}/admin/reset-password?token=${token}`;

        await resend.emails.send({
            from: '神言学システム <admin@resend.dev>', // Depending on Resend setup
            to: email,
            subject: '【神言学】パスワードリセットのご案内',
            html: `
                <p>${user.username} 様</p>
                <p>パスワードリセットのリクエストを受け付けました。</p>
                <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>※リンクの有効期限は30分です。</p>
            `,
        });

        return NextResponse.json({ success: true, message: 'メールを送信しました' });

    } catch (e) {
        console.error('Forgot Password Error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
