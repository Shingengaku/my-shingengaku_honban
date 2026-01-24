import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('online_options')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Online options fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch online options' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error('Online options API error:', e);
        return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
    }
}
