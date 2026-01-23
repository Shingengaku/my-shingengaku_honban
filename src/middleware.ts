import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
