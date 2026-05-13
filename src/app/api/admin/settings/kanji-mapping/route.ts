import { NextResponse } from 'next/server';
import { KANJI_MAP as DEFAULT_KANJI_MAP } from '@/lib/kanjiNormalize';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'kanji_mapping')
            .single();

        if (error || !data) {
            return NextResponse.json(DEFAULT_KANJI_MAP);
        }
        return NextResponse.json(data.value);
    } catch (e) {
        return NextResponse.json(DEFAULT_KANJI_MAP);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mapping } = body;

        if (!mapping || typeof mapping !== 'object') {
            return NextResponse.json({ error: 'Invalid mapping data' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('app_settings')
            .upsert({ key: 'kanji_mapping', value: mapping }, { onConflict: 'key' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error saving kanji mapping:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
