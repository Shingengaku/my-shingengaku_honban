import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { id, ids } = await request.json();

        if (!id && !ids) {
            return NextResponse.json({ error: 'ID or IDs are required' }, { status: 400 });
        }

        let query = supabaseAdmin.from('applications').delete();

        if (ids && Array.isArray(ids)) {
            query = query.in('id', ids);
        } else {
            query = query.eq('id', id);
        }

        const { error } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Delete Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
