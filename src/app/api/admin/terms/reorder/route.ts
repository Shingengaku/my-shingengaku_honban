
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items } = body; // Array of { id: number, sort_order: number }

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Supabase doesn't support bulk update with different values easily in one query via JS client 
        // without RPC or complex upsert logic. 
        // We will loop for now as the number of terms is small (usually < 100).
        // Alternatively, we can use upsert if we include all required fields, but we only want to update sort_order.
        // Let's use Promise.all with updates.

        // Note: Ideally use RPC for atomicity, but for this scale JS loop is acceptable.

        const updates = items.map((item: any) =>
            supabaseAdmin
                .from('terms')
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
