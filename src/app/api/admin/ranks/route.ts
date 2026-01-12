
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
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check for duplicate name
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
        return NextResponse.json({ error: 'Failed to create rank' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, base_fee, sort_order } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

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
        return NextResponse.json({ error: 'Failed to update rank' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('ranks')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error deleting rank:', e);
        return NextResponse.json({ error: 'Failed to delete rank' }, { status: 500 });
    }
}
