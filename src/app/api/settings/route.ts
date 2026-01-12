import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    // Fetch only necessary public settings
    const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'application_text')
        .single();

    // It's possible the key doesn't exist yet, which is not an error
    if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = {
        application_text: data?.value || ''
    };

    return NextResponse.json(settings);
}
