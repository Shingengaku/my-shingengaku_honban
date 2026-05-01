import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'IDが指定されていません' }, { status: 400 });
        }

        // 元のデータを取得
        const { data: originalApps, error: fetchError } = await supabaseAdmin
            .from('applications')
            .select('*')
            .in('id', ids);

        if (fetchError || !originalApps || originalApps.length === 0) {
            console.error('Fetch error for duplication:', fetchError);
            return NextResponse.json({ error: '元データの取得に失敗しました' }, { status: 500 });
        }

        // 新規挿入用のデータを作成
        const newApps = originalApps.map(app => {
            // 自動生成されるフィールドや不要な情報を削除
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, created_at, updated_at, ...rest } = app;

            // 複製したものは未決済にリセットする
            return {
                ...rest,
                payment_status: app.total_amount === 0 ? 'paid' : 'unpaid'
            };
        });

        // データベースに挿入
        const { data: insertedApps, error: insertError } = await supabaseAdmin
            .from('applications')
            .insert(newApps)
            .select('id');

        if (insertError) {
            console.error('Insert error during duplication:', insertError);
            return NextResponse.json({
                error: '複製の作成に失敗しました',
                details: insertError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `${insertedApps.length}件のデータを複製しました`
        });

    } catch (e: any) {
        console.error('Duplicate Handler Error:', e);
        return NextResponse.json({
            error: 'Server Error',
            details: e?.message || JSON.stringify(e)
        }, { status: 500 });
    }
}
