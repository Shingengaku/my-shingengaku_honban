import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Check if the path starts with /admin
    if (request.nextUrl.pathname.startsWith('/admin')) {

        // Allow access to login page and authentication API
        if (
            request.nextUrl.pathname === '/admin/login' ||
            request.nextUrl.pathname.startsWith('/api/admin/login')
        ) {
            return NextResponse.next();
        }

        // Check for admin_session cookie
        const adminSession = request.cookies.get('admin_session');

        if (!adminSession) {
            // Redirect to login if no session
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
