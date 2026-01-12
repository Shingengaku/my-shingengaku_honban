
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Fetch all terms (admin view)
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('terms')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // Fallback

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch terms' }, { status: 500 });
    }
}

// POST: Create a new term
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // Get max sort_order to append at the end
        const { data: maxOrderData } = await supabaseAdmin
            .from('terms')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

        const nextOrder = (maxOrderData?.sort_order ?? 0) + 10;

        const { data, error } = await supabaseAdmin
            .from('terms')
            .insert({ name, sort_order: nextOrder })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create term' }, { status: 500 });
    }
}

// DELETE: Delete a term
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('terms')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete term' }, { status: 500 });
    }
}
