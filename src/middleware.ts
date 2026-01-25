import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
    // パスが /admin で始まるか確認
    if (request.nextUrl.pathname.startsWith('/admin')) {
        // ログインページと認証APIへのアクセスを許可
        if (
            request.nextUrl.pathname === '/admin/login' ||
            request.nextUrl.pathname.startsWith('/api/admin/login')
        ) {
            return NextResponse.next();
        }

        // admin_session クッキーを確認
        const adminSession = request.cookies.get('admin_session');

        if (!adminSession) {
            // セッションがない場合はログインへリダイレクト
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // セッション検証
        const username = await verifySession(adminSession.value);
        if (!username) {
            // 署名検証失敗（改ざん等）
            const response = NextResponse.redirect(new URL('/admin/login', request.url));
            response.cookies.delete('admin_session');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
