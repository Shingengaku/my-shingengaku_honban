
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// 引用符とカンマに関してCSVを手動で解析するヘルパー
function parseCSV(text: string) {
    // BOMがあれば削除
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { headers: [], records: [] };

    // カンマで分割し、囲みの引用符を削除する単純なパーサー
    // 注: 引用符内のカンマは正しく処理されません。
    // 堅牢なCSV解析にはライブラリが推奨されますが、単純なリストにはこれで十分です。
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // ヘッダー名をキーにマップ
    // 期待値: 氏名, ふりがな, メールアドレス, ランク(属性), 期
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
        '期生': 'generation',
        '特進': 'is_tokushin'
    };

    const mappedHeaders = headers.map(h => keyMap[h] || h);

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // 値を分割してクリーニング
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        // 末尾の空行を許可
        if (values.length === 1 && values[0] === '') continue;

        if (values.length < mappedHeaders.length) {
            // 列数不足
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

        // 必須ヘッダーを確認
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

        // 1. ランクと期を取得
        const [ranksRes, termsRes] = await Promise.all([
            supabaseAdmin.from('ranks').select('id, name'),
            supabaseAdmin.from('terms').select('id, name')
        ]);

        if (ranksRes.error) throw ranksRes.error;
        if (termsRes.error) throw termsRes.error;

        const rankMap = new Map<string, number>();
        ranksRes.data?.forEach(r => rankMap.set(r.name, r.id));

        const termMap = new Map<string, number>();
        termsRes.data?.forEach(t => termMap.set(t.name, t.id));
        // 正規化サポートを追加（例: "1" -> "1期"）が必要か、完全一致に依存するか。
        // "1" が "1期" に部分一致することもサポートしますか？
        // 数値の正規化マップも作成しましょう
        termsRes.data?.forEach(t => {
            const numDetail = t.name.match(/\d+/);
            if (numDetail) {
                termMap.set(numDetail[0], t.id); // "1" -> "1期" のID
            }
        });

        // 2. マッチングデータの準備
        const upsertData = [];

        for (const row of records) {
            if (row._error) {
                errors.push(`スキップ: ${row._error} (行データ: ${row._raw})`);
                continue;
            }

            const { name, furigana, email, rank_name, generation, is_tokushin } = row;

            if (!email || !name) {
                errors.push(`スキップ: 氏名またはメールアドレスが空欄です (行データ: ${JSON.stringify(row)})`);
                continue;
            }

            let rankId = rankMap.get(rank_name);
            if (!rankId) {
                // 有効な場合はデフォルトへのフォールバックを試みるか、警告します
                if (ranksRes.data && ranksRes.data.length > 0) {
                    // 今のところ、欠落している場合は最初のランクを使用しますか？それともエラー？
                    // 既存のロジックは警告して最初を使用していました。
                    rankId = ranksRes.data[0].id;
                    errors.push(`警告: 属性 "${rank_name}" が不明なため、既定の "${ranksRes.data[0].name}" を設定しました (メール: ${email})`);
                }
            }

            // 期の解析
            let termId: number | null = null;
            if (generation) {
                // 完全一致を試行
                termId = termMap.get(generation) || null;
                // generationが数値のみの場合、"X期" 形式を試行
                if (!termId && /^\d+$/.test(generation)) {
                    termId = termMap.get(`${generation}期`) || null;
                }
            }
            // まだnullの場合、最初の期をデフォルトにしますか？それともnullを許可しますか？
            // membersテーブルの `term_id` はnullableの可能性があります？スキーマはintと言っています。
            // 見つからない場合は最初の期をデフォルトにしましょう
            if (!termId && termsRes.data && termsRes.data.length > 0) {
                // generationが提供されたが見つからなかった場合を確認
                if (generation) {
                    errors.push(`警告: 期 "${generation}" が不明なため、既定の "${termsRes.data[0].name}" を設定しました`);
                }
                termId = termsRes.data[0].id;
            }

            // 特進フラグの解析: "特進" string, "true", "TRUE", "1" -> true
            // 空文字, "false", "0" -> false
            let isTokushinBool = false;
            if (typeof is_tokushin === 'string') {
                const val = is_tokushin.trim();
                if (val === '特進' || val.toLowerCase() === 'true' || val === '1' || val === 'あり') {
                    isTokushinBool = true;
                }
            } else if (typeof is_tokushin === 'boolean') {
                isTokushinBool = is_tokushin;
            }

            upsertData.push({
                name,
                furigana: furigana || name,
                email,
                rank_id: rankId,
                term_id: termId,
                is_tokushin: isTokushinBool
            });
        }

        let savedCount = 0;
        let mergedCount = 0;

        // 3. メンバーへの処理 (手動Upsert: 氏名 + 期 の複合キー判定)
        if (upsertData.length > 0) {
            // バッチ内で氏名+期による重複排除 (CSV内の最新を優先)
            const uniqueInput = Array.from(
                new Map(upsertData.map(item => [`${item.name}_${item.term_id}`, item])).values()
            );

            savedCount = uniqueInput.length;
            mergedCount = upsertData.length - uniqueInput.length;

            const names = uniqueInput.map(u => u.name);

            // Fetch existing members by name to check for term collisions
            // Note: If names array is huge, we might need chunking. Assuming reasonable CSV size (<1000 rows).
            const { data: existingMembers, error: fetchError } = await supabaseAdmin
                .from('members')
                .select('id, name, term_id')
                .in('name', names);

            if (fetchError) throw fetchError;

            // Map key: "name_termId"
            const existingMap = new Map<string, string>();
            existingMembers?.forEach(m => {
                existingMap.set(`${m.name}_${m.term_id}`, m.id);
            });

            const toInsert: any[] = [];
            const toUpdate: any[] = [];

            for (const item of uniqueInput) {
                const key = `${item.name}_${item.term_id}`;
                if (existingMap.has(key)) {
                    if (mode === 'overwrite') {
                        // 更新対象: IDは既存のものを使用、データはCSVの内容
                        toUpdate.push({
                            id: existingMap.get(key),
                            ...item
                        });
                    }
                    // skipモードなら何もしない
                } else {
                    toInsert.push(item);
                }
            }

            // Execute Insert
            if (toInsert.length > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('members')
                    .insert(toInsert);

                if (insertError) throw insertError;
            }

            // Execute Update
            if (toUpdate.length > 0) {
                // Update one by one
                const updatePromises = toUpdate.map(item => {
                    const { id, ...updateData } = item;
                    return supabaseAdmin
                        .from('members')
                        .update(updateData)
                        .eq('id', id);
                });

                await Promise.all(updatePromises);
            }

            // スキップされた重複 (CSV内重複)
            if (mergedCount > 0) {
                errors.unshift(`ℹ️ 重複統合: ${mergedCount} 件のデータが、同じ氏名・期のため統合(上書き)されました。`);
            }
        }

        return NextResponse.json({
            success: true,
            count: upsertData.length,      // CSVから読み取れた有効データ数
            savedCount,                    // 実際にDBへ保存しようとした数
            mergedCount,                   // 重複により統合された数 (重複排除された数)
            errors
        });

    } catch (e) {
        console.error('Import error:', e);
        const errorMessage = e instanceof Error ? e.message : (typeof e === 'object' ? JSON.stringify(e) : String(e));
        return NextResponse.json({ error: `システムエラー詳細: ${errorMessage}` }, { status: 500 });
    }
}
