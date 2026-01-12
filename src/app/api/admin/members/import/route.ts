
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Helper to parse CSV manually regarding quotes and commas
function parseCSV(text: string) {
    // Remove BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { headers: [], records: [] };

    // Simple parser that splits by comma, removing surrounding quotes
    // Note: This does not handle commas INSIDE quotes correctly. 
    // For robust CSV parsing, a library is recommended, but this suffices for simple lists.
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Map header names to keys
    // Expected: 氏名, ふりがな, メールアドレス, ランク(属性), 期
    const keyMap: Record<string, string> = {
        '氏名': 'name',
        '名前': 'name',
        'ふりがな': 'furigana',
        'フリガナ': 'furigana',
        'メールアドレス': 'email',
        'メール': 'email',
        'Email': 'email',
        'ランク': 'rank_name',
        '属性': 'rank_name',
        '期': 'generation',
        '期生': 'generation'
    };

    const mappedHeaders = headers.map(h => keyMap[h] || h);

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Split and clean values
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        // Allow empty lines at end
        if (values.length === 1 && values[0] === '') continue;

        if (values.length < mappedHeaders.length) {
            // Not enough columns
            records.push({ _error: `列数不足 (項目数: ${values.length}, ヘッダー数: ${mappedHeaders.length})`, _raw: line });
            continue;
        }

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
        const mode = formData.get('mode') as string || 'overwrite';
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'ファイルがアップロードされていません' }, { status: 400 });
        }

        const text = await file.text();
        const { headers, records } = parseCSV(text);

        const errors = [];

        // Check required headers
        if (!headers.includes('name')) {
            errors.push('エラー: 「氏名」列が見つかりません。CSVの1行目を確認してください。(文字化けの可能性もあります)');
        }
        if (!headers.includes('email')) {
            errors.push('エラー: 「メールアドレス」列が見つかりません。CSVの1行目を確認してください。');
        }

        if (errors.length > 0) {
            return NextResponse.json({
                success: false,
                count: 0,
                error: 'ヘッダーエラー',
                errors
            });
        }

        if (records.length === 0) {
            return NextResponse.json({ error: 'データ行が見つかりません' }, { status: 400 });
        }

        // 1. Fetch Ranks to map Name -> ID
        const { data: ranks, error: rankError } = await supabaseAdmin
            .from('ranks')
            .select('id, name');

        if (rankError) throw rankError;

        const rankMap = new Map<string, number>();
        ranks?.forEach(r => rankMap.set(r.name, r.id));

        // 2. Prepare Match data
        const upsertData = [];

        for (const row of records) {
            if (row._error) {
                errors.push(`スキップ: ${row._error} (行データ: ${row._raw})`);
                continue;
            }

            const { name, furigana, email, rank_name, generation } = row;

            if (!email || !name) {
                errors.push(`スキップ: 氏名またはメールアドレスが空欄です (行データ: ${JSON.stringify(row)})`);
                continue;
            }

            let rankId = rankMap.get(rank_name);
            if (!rankId) {
                errors.push(`警告: 属性 "${rank_name}" がシステムに見つからないため、登録をスキップします (メール: ${email})`);
                // If strictly requiring rank, skip explicitly
                if (!rankId && ranks && ranks.length > 0) {
                    rankId = ranks[0].id;
                    errors.push(`→ 注意: 属性をデフォルトの "${ranks[0].name}" に設定しました。`);
                }
            }

            // Generation parsing
            let gen = parseInt(generation?.replace('期', '') || '0');
            if (isNaN(gen)) gen = 0;

            upsertData.push({
                name,
                furigana: furigana || name,
                email,
                rank_id: rankId,
                generation: gen
            });
        }

        // 3. Upsert to Members
        if (upsertData.length > 0) {
            // Deduplicate by email within the batch
            const uniqueUpserts = Array.from(
                new Map(upsertData.map(item => [item.email, item])).values()
            );

            const { error: upsertError } = await supabaseAdmin
                .from('members')
                .upsert(uniqueUpserts, {
                    onConflict: 'email',
                    ignoreDuplicates: mode === 'skip'
                });

            if (upsertError) throw upsertError;

            // Warn about skipped duplicates if count differs
            if (uniqueUpserts.length < upsertData.length) {
                const diff = upsertData.length - uniqueUpserts.length;
                errors.push(`情報: ファイル内で重複しているメールアドレスが ${diff} 件あり、最後のデータで上書きされました。`);
            }
        }

        return NextResponse.json({
            success: true,
            count: upsertData.length,
            errors
        });

    } catch (e) {
        console.error('Import error:', e);
        // Supabase error objects are often plain objects with a message property, not instances of Error
        const errorMessage = e instanceof Error ? e.message : (typeof e === 'object' ? JSON.stringify(e) : String(e));
        return NextResponse.json({ error: `システムエラー詳細: ${errorMessage}` }, { status: 500 });
    }
}
