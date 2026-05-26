import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

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
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'ユーザーIDまたはパスワードが間違っています' }, { status: 401 });
        }

    } catch (e) {
        console.error('Credentials verification error:', e);
        return NextResponse.json({ error: 'システムエラーが発生しました' }, { status: 500 });
    }
}
