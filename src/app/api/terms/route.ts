
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: terms, error } = await supabaseAdmin
            .from('terms')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // フォールバック

        if (error) {
            console.error('Error fetching terms:', error);
            return NextResponse.json({ error: 'Failed to fetch terms' }, { status: 500 });
        }

        return NextResponse.json(terms);
    } catch (e) {
        console.error('Unexpected error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
