
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
    try {
        const { data, error } = await supabaseAdmin
            .from('ranks')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error fetching ranks:', e);
        return NextResponse.json({ error: 'Failed to fetch ranks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, base_fee, sort_order, group } = body;

        if (!name || base_fee === undefined || sort_order === undefined) {
            return NextResponse.json({ error: '必須フィールドが不足しています' }, { status: 400 });
        }

        // 重複名の確認
        const { data: existing } = await supabaseAdmin
            .from('ranks')
            .select('id')
            .eq('name', name)
            .single();

        if (existing) {
            return NextResponse.json({ error: '同名のランクが既に存在します' }, { status: 409 });
        }

        const { data, error } = await supabaseAdmin
            .from('ranks')
            .insert({ 
                name, 
                base_fee, 
                sort_order, 
                group: group || (name.includes('特進') ? 'tokushin' : (name.includes('経営幹部') ? 'executive' : (name.includes('紹介') ? 'referral' : 'terms')))
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error creating rank:', e);
        return NextResponse.json({ error: 'ランクの作成に失敗しました' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, base_fee, sort_order, group } = body;

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        // 以前の情報を取得
        const { data: oldRank } = await supabaseAdmin
            .from('ranks')
            .select('name')
            .eq('id', id)
            .single();

        const { data, error } = await supabaseAdmin
            .from('ranks')
            .update({ name, base_fee, sort_order, group })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 名称が変更された場合、申込データの属性名を一括更新
        if (name && oldRank && oldRank.name !== name) {
            console.log(`Renaming rank from "${oldRank.name}" to "${name}" in applications...`);
            
            await supabaseAdmin
                .from('applications')
                .update({ applied_rank_name: name })
                .eq('applied_rank_name', oldRank.name);
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error updating rank:', e);
        return NextResponse.json({ error: 'ランクの更新に失敗しました' }, { status: 500 });
    }
}

// 使用状況を確認するヘルパー
async function checkUsage(rankId: string) {
    // 1. メンバー（受講生）チェック
    const { count, error: countError } = await supabaseAdmin
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('rank_id', rankId);

    if (countError) throw countError;
    if (count && count > 0) return '受講生データに使用されているため削除できません';

    // 2. 商品設定チェック
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'payment_links')
        .single();

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    if (settings?.value && Array.isArray(settings.value)) {
        const products = settings.value;
        // rank_id はJSON内で文字列または数値の可能性があります
        const used = products.some((p: any) => String(p.rank_id) === String(rankId));
        if (used) return '商品マスタ（決済リンク設定）に使用されているため削除できません';
    }

    return null; // OK
}

// DELETE関数の内容ロジックをオーバーライド
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        // 使用状況を事前チェック
        const usageError = await checkUsage(id);
        if (usageError) {
            return NextResponse.json({ error: usageError }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('ranks')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting rank:', e);
        if (e.code === '23503') {
            // 競合状態のフォールバック
            return NextResponse.json({ error: 'この属性は既に使用されているため削除できません' }, { status: 400 });
        }
        return NextResponse.json({ error: 'ランクの削除に失敗しました' }, { status: 500 });
    }
}
