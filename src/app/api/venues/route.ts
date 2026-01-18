import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('venues')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error('Venues fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error('Venues API error:', e);
        return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
    }
}
