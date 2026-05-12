
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function parseCSV(text: string) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { headers: [], records: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const mappedHeaders = headers.map(h => {
        if (h === '属性名' || h === '名前' || h === 'Name') return 'name';
        if (h === '会費' || h === 'base_fee') return 'base_fee';
        if (h === 'グループ' || h === 'group') return 'group';
        if (h === '並び順' || h === 'sort_order') return 'sort_order';
        return h;
    });

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length === 1 && values[0] === '') continue;
        if (values.length < mappedHeaders.length) continue;

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

        const validGroups = ['tokushin', 'terms', 'general', 'executive', 'referral'];

        for (const row of records) {
            if (!row.name) {
                errors.push('Skipped row with missing name');
                continue;
            }

            // groupのバリデーション: 有効値でない場合は 'terms' をデフォルトに
            const group = validGroups.includes(row.group) ? row.group : 'terms';

            upsertData.push({
                name: row.name,
                base_fee: row.base_fee ? Number(row.base_fee) : 0,
                group,
                sort_order: row.sort_order ? Number(row.sort_order) : 999
            });
        }

        const { error } = await supabaseAdmin
            .from('ranks')
            .upsert(upsertData, { onConflict: 'name' });

        if (error) throw error;

        return NextResponse.json({ success: true, count: upsertData.length, errors });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
    }
}
