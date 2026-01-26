
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

// GET: ユーザー一覧
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, username, email, created_at')
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: '内部エラー' }, { status: 500 });
    }
}

// POST: ユーザー作成
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password, email } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'ユーザー名とパスワードは必須です' }, { status: 400 });
        }

        if (!email) {
            return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
        }

        // パスワードをハッシュ化
        const shasum = crypto.createHash('sha256');
        shasum.update(password.trim());
        const hashedPassword = shasum.digest('hex');

        // 挿入
        const { error } = await supabaseAdmin
            .from('admin_users')
            .insert({
                username: username.trim(),
                email: email.trim(),
                password_hash: hashedPassword
            });

        if (error) {
            if (error.code === '23505') { // 一意性制約違反
                return NextResponse.json({ error: 'ユーザー名またはメールアドレスは既に存在します' }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        return NextResponse.json({ error: '内部エラー' }, { status: 500 });
    }
}

// DELETE: ユーザー削除
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

        // 基本チェック: 最後のユーザーを削除できないようにする?
        // または、リクエストされた場合に 'admin' の削除を防ぐ?
        // 簡単にするため、単に削除します。

        const { error } = await supabaseAdmin
            .from('admin_users')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: '内部エラー' }, { status: 500 });
    }
}
