
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
    try {
        const { data, error } = await supabaseAdmin
            .from('venues')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error fetching venues:', e);
        return NextResponse.json({ error: 'Failed to fetch venues' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, type, sort_order } = body;

        if (!name || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('venues')
            .insert({
                name,
                type,
                sort_order: sort_order ? Number(sort_order) : 0
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error creating venue:', e);
        return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('venues')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error deleting venue:', e);
        return NextResponse.json({ error: 'Failed to delete venue' }, { status: 500 });
    }
}
