
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
        const { name, base_fee, sort_order } = body;

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
            .insert({ name, base_fee, sort_order })
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
        const { id, name, base_fee, sort_order } = body;

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('ranks')
            .update({ name, base_fee, sort_order })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error updating rank:', e);
        return NextResponse.json({ error: 'ランクの更新に失敗しました' }, { status: 500 });
    }
}

// Helper to check usage
async function checkUsage(rankId: string) {
    // 1. Members check
    const { count, error: countError } = await supabaseAdmin
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('rank_id', rankId);

    if (countError) throw countError;
    if (count && count > 0) return '受講生データに使用されているため削除できません';

    // 2. Product Settings check
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'payment_links')
        .single();

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    if (settings?.value && Array.isArray(settings.value)) {
        const products = settings.value;
        // rank_id might be string or number in JSON
        const used = products.some((p: any) => String(p.rank_id) === String(rankId));
        if (used) return '商品マスタ（決済リンク設定）に使用されているため削除できません';
    }

    return null; // OK
}

// Override the DELETE function content logic
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

        // Pre-check usage
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
            // Fallback for race conditions
            return NextResponse.json({ error: 'この属性は既に使用されているため削除できません' }, { status: 400 });
        }
        return NextResponse.json({ error: 'ランクの削除に失敗しました' }, { status: 500 });
    }
}
