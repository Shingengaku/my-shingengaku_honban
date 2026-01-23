
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

        if (values.length < mappedHeaders.length) continue; // 不完全な場合はスキップ

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

        if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });

        const text = await file.text();
        const { records } = parseCSV(text);

        if (records.length === 0) {
            return NextResponse.json({ error: 'レコードが見つかりません' }, { status: 400 });
        }

        const upsertData = [];
        const errors = [];

        // 既存フェッチロジック？ いいえ、単に名前でupsertするか、挿入を試みます。
        // 実際には、名前は一意であるべきです。
        // 提供されていない場合、sort_orderを決定するために既存のものを取得する必要がありますか？
        // または、DBのデフォルトに任せます（ただし、DBはコンテンツに基づいて自動的にsort_orderをインクリメントしない可能性があります）。
        // ここでは、欠落している場合はsort_orderを999にデフォルト設定しましょう。

        for (const row of records) {
            if (!row.name) {
                errors.push('名前がない行をスキップしました');
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
