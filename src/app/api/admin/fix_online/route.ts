import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('online_options')
            .insert({ name: 'LIVE視聴（2会場）', type: 'online', sort_order: 15 })
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ error: 'System Error' }, { status: 500 });
    }
}
