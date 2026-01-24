import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    // Fetch only necessary public settings
    const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .in('key', ['application_text', 'application_active', 'application_title']);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert array to object
    const settingsMap: any = {};
    data?.forEach(row => {
        settingsMap[row.key] = row.value;
    });

    const settings = {
        application_text: settingsMap.application_text || '',
        application_active: settingsMap.application_active !== false, // Default to true if not set or explicitly true
        application_title: settingsMap.application_title || ''
    };

    return NextResponse.json(settings);
}
