import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // セッションクッキーを削除
    response.cookies.delete('admin_session');

    return response;
}
