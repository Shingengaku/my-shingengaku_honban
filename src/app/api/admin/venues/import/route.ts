
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function parseCSV(text: string) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { headers: [], records: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const mappedHeaders = headers.map(h => {
        if (h === '会場名' || h === '名前' || h === 'Name') return 'name';
        if (h === 'タイプ(lecture/social)' || h === 'タイプ' || h === 'type') return 'type';
        if (h === 'エリア' || h === 'area') return 'area';
        if (h === '募集終了' || h === 'is_recruitment_ended') return 'is_recruitment_ended';
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

        for (const row of records) {
            if (!row.name) {
                errors.push('Skipped row with missing name');
                continue;
            }
            if (!row.type) {
                row.type = 'lecture'; // デフォルト
            }

            // エリアのバリデーション
            const validAreas = ['tokyo', 'fukuoka', 'online'];
            const area = validAreas.includes(row.area) ? row.area : 'tokyo';

            // 募集終了フラグ: "1", "true", "あり" -> true
            const isRecruitmentEnded = row.is_recruitment_ended === '1' ||
                String(row.is_recruitment_ended).toLowerCase() === 'true' ||
                row.is_recruitment_ended === 'あり';

            upsertData.push({
                name: row.name,
                type: row.type,
                area,
                is_recruitment_ended: isRecruitmentEnded,
                sort_order: row.sort_order ? Number(row.sort_order) : 999
            });
        }

        const { error } = await supabaseAdmin
            .from('venues')
            .upsert(upsertData, { onConflict: 'name' });

        if (error) throw error;

        return NextResponse.json({ success: true, count: upsertData.length, errors });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
    }
}
