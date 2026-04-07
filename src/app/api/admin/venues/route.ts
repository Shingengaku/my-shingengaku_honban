
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

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, type, sort_order, is_recruitment_ended } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // 以前の名称を取得（連動更新のため）
        const { data: oldVenue } = await supabaseAdmin
            .from('venues')
            .select('name')
            .eq('id', id)
            .single();

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (type !== undefined) updateData.type = type;
        if (sort_order !== undefined) updateData.sort_order = Number(sort_order);
        if (is_recruitment_ended !== undefined) updateData.is_recruitment_ended = is_recruitment_ended;

        const { data, error } = await supabaseAdmin
            .from('venues')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 名称が変更された場合、申込データの会場名を一括更新
        if (name && oldVenue && oldVenue.name !== name) {
            console.log(`Renaming venue from "${oldVenue.name}" to "${name}" in applications...`);
            
            // 講義会場としての更新
            await supabaseAdmin
                .from('applications')
                .update({ venue: name })
                .eq('venue', oldVenue.name);

            // 懇親会会場としての更新
            await supabaseAdmin
                .from('applications')
                .update({ social_venue: name })
                .eq('social_venue', oldVenue.name);
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error('Error updating venue:', e);
        return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
    }
}
