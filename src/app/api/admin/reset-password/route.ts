
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json({ error: 'トークンまたはパスワードが不足しています' }, { status: 400 });
        }

        // トークンでユーザーを検索
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, reset_token_expires')
            .eq('reset_token', token)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: '無効なリンクです' }, { status: 400 });
        }

        // 有効期限を確認
        if (new Date(user.reset_token_expires) < new Date()) {
            return NextResponse.json({ error: 'リンクの有効期限が切れています' }, { status: 400 });
        }

        // 新しいパスワードをハッシュ化
        const shasum = crypto.createHash('sha256');
        shasum.update(password.trim().normalize('NFKC'));
        const hashedPassword = shasum.digest('hex');

        // パスワードを更新し、トークンをクリア
        const { error: updateError } = await supabaseAdmin
            .from('admin_users')
            .update({
                password_hash: hashedPassword,
                reset_token: null,
                reset_token_expires: null
            })
            .eq('id', user.id);

        if (updateError) {
            return NextResponse.json({ error: 'パスワードの更新に失敗しました' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'パスワードを更新しました' });

    } catch (e) {
        console.error('Reset Password Error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
