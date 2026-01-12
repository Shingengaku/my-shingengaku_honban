
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const requestBody = await request.json();
        const { ids, status, is_duplicate_confirmed } = requestBody;

        if (!Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const updates: any = {};
        if (status !== undefined) updates.payment_status = status;
        if (is_duplicate_confirmed !== undefined) updates.is_duplicate_confirmed = is_duplicate_confirmed;
        if (requestBody.tags !== undefined) updates.tags = requestBody.tags;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('applications')
            .update(updates)
            .in('id', ids);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
