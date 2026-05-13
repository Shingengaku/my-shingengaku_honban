import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { signSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'ユーザーIDとパスワードを入力してください' }, { status: 400 });
        }

        // 入力パスワードをハッシュ化
        const shasum = crypto.createHash('sha256');
        shasum.update(password.trim().normalize('NFKC'));
        const hashedPassword = shasum.digest('hex');

        // DBと照合
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('username', username.trim().normalize('NFKC'))
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'ユーザーIDまたはパスワードが間違っています' }, { status: 401 });
        }

        if (user.password_hash === hashedPassword) {
            const response = NextResponse.json({ success: true });

            // 署名付きセッショントークンを生成
            const sessionToken = await signSession(user.username);

            // セッションクッキーを設定
            response.cookies.set('admin_session', sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 // 1 day
            });

            return response;
        } else {
            return NextResponse.json({ error: 'ユーザーIDまたはパスワードが間違っています' }, { status: 401 });
        }

    } catch (e) {
        console.error('Login error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
