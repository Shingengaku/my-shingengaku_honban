import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        // 本番環境での全件削除を防止
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: '本番環境では全データの一括削除は禁止されています。' }, { status: 403 });
        }

        // 全件削除
        // delete() は WHERE 句がないとエラーになるため、
        // 必ず真になる条件 (id is not null) を指定する
        const { error } = await supabaseAdmin
            .from('applications')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
            console.error('Truncate error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
