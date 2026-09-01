import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { signSession } from '@/lib/auth';

/**
 * Supabaseクエリをリトライ付きで実行する
 * コールドスタートや一時的なネットワーク障害に対応
 */
async function queryUserWithRetry(normalizedUsername: string, maxRetries = 2) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('username', normalizedUsername)
            .single();

        if (!error) {
            return { user, error: null };
        }

        // PGRST116 = "JSON object requested, return zero rows" → ユーザーが見つからない（リトライ不要）
        if (error.code === 'PGRST116') {
            return { user: null, error: null };
        }

        // それ以外のエラー（接続エラー等）はリトライ
        lastError = error;
        console.warn(`[Login] Supabase query attempt ${attempt + 1} failed:`, error.message, `(code: ${error.code})`);

        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
    return { user: null, error: lastError };
}

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

        // DBと照合（リトライ付き）
        const normalizedUsername = username.trim().normalize('NFKC');
        const { user, error } = await queryUserWithRetry(normalizedUsername);

        // DB接続エラーの場合はシステムエラーとして返す（認証エラーと区別）
        if (error) {
            console.error('[Login] DB connection error after retries:', error);
            return NextResponse.json(
                { error: 'データベースへの接続に失敗しました。しばらくしてから再度お試しください。' },
                { status: 503 }
            );
        }

        // ユーザーが見つからない場合
        if (!user) {
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
                maxAge: 60 * 60 * 24 * 7 // 7 days
            });

            return response;
        } else {
            return NextResponse.json({ error: 'ユーザーIDまたはパスワードが間違っています' }, { status: 401 });
        }

    } catch (e) {
        console.error('[Login] Unexpected error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
