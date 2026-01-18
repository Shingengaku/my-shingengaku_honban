
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function parseCSV(text: string) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { headers: [], records: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const mappedHeaders = headers.map(h => {
        if (h === '期名' || h === '名前' || h === 'Name') return 'name';
        return h;
    });

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length === 1 && values[0] === '') continue;

        if (values.length < mappedHeaders.length) continue; // Skip incomplete

        const row: any = {};
        mappedHeaders.forEach((header, index) => {
            row[header] = values[index];
        });
        records.push(row);
    }
    return { headers: mappedHeaders, records };
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

        const text = await file.text();
        const { records } = parseCSV(text);

        if (records.length === 0) {
            return NextResponse.json({ error: 'No records found' }, { status: 400 });
        }

        const upsertData = [];
        const errors = [];

        // Fetch existing logic? No, just upsert by Name or attempt insert.
        // Actually, name should be unique.
        // We need to fetch existing to determine sort_order if not provided?
        // Or just let DB defaults handle it (although DB doesn't likely auto-increment sort_order based on content).
        // Let's just default sort_order to 999 if missing.

        for (const row of records) {
            if (!row.name) {
                errors.push('Skipped row with missing name');
                continue;
            }
            upsertData.push({
                name: row.name,
                sort_order: row.sort_order ? Number(row.sort_order) : 999
            });
        }

        const { error } = await supabaseAdmin
            .from('terms')
            .upsert(upsertData, { onConflict: 'name' });

        if (error) throw error;

        return NextResponse.json({ success: true, count: upsertData.length, errors });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
    }
}
