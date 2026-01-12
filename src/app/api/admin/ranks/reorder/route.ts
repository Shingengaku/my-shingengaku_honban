
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items } = body; // Array of { id: number, sort_order: number }

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const updates = items.map((item: any) =>
            supabaseAdmin
                .from('ranks')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id)
        );

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Reorder error:', e);
        return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
    }
}
