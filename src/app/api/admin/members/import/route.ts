
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import * as XLSX from 'xlsx';

// 堅牢なファイル解析（CSV/Excel両対応、Shift-JIS対応）
function parseFile(buffer: ArrayBuffer, fileName: string) {
    const uint8 = new Uint8Array(buffer);
    const isCSV = fileName.toLowerCase().endsWith('.csv');

    let workbook;
    if (isCSV) {
        // CSVの場合は UTF-8 か Shift-JIS かを判定して読み込む
        let content = '';
        try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            content = utf8Decoder.decode(uint8);
        } catch (e) {
            const sjisDecoder = new TextDecoder('shift-jis');
            content = sjisDecoder.decode(uint8);
        }
        workbook = XLSX.read(content, { type: 'string' });
    } else {
        // Excel (.xlsx) の場合はバイナリとして読み込む
        workbook = XLSX.read(buffer, { type: 'array' });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!jsonData || jsonData.length === 0) return { headers: [], records: [] };

    // ヘッダー（1行目のキー）を取得
    const rawHeaders = Object.keys(jsonData[0] as object);

    // ヘッダー名を内部キーにマップ
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
        '特進': 'is_tokushin',
        '集計除外': 'exclude_from_count'
    };

    const mappedHeaders = rawHeaders.map(h => keyMap[h.trim()] || h.trim());

    const records = (jsonData as any[]).map(row => {
        const obj: any = {};
        Object.entries(row).forEach(([k, v]) => {
            const mappedKey = keyMap[k.trim()] || k.trim();
            obj[mappedKey] = v;
        });
        return obj;
    });

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

        const buffer = await file.arrayBuffer();
        const { headers, records } = parseFile(buffer, file.name);

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

            const { name, furigana, email, rank_name, generation, is_tokushin, exclude_from_count } = row;

            if (!name) {
                errors.push(`スキップ: 氏名が空欄です (行データ: ${JSON.stringify(row)})`);
                continue;
            }

            let rankId = rankMap.get(rank_name);
            if (!rankId) {
                // 有効な場合はデフォルトへのフォールバックを試みるか、警告します
                if (ranksRes.data && ranksRes.data.length > 0) {
                    // 今のところ、欠落している場合は最初のランクを使用しますか？それともエラー？
                    // 既存のロジックは警告して最初を使用していました。
                    rankId = ranksRes.data[0].id;
                    if (rank_name) {
                        errors.push(`警告: 属性 "${rank_name}" が不明なため、既定の "${ranksRes.data[0].name}" を設定しました (氏名: ${name})`);
                    }
                }
            }

            // 期の解析
            let termId: number | null = null;
            if (generation) {
                // 完全一致を試行
                termId = termMap.get(generation) || null;

                // 数値抽出を試行 ("11期生" -> "11", "第1期" -> "1")
                if (!termId) {
                    const numMatch = generation.match(/\d+/);
                    if (numMatch) {
                        const numStr = numMatch[0];
                        // "11" -> "11期" で再検索
                        termId = termMap.get(`${numStr}期`) || null;
                        // "11" そのままで検索
                        if (!termId) {
                            termId = termMap.get(numStr) || null;
                        }
                    }
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
            // 特進フラグの解析: 文字列, 数値, 真偽値のいずれも考慮
            let isTokushinBool = false;
            const tVal = is_tokushin;
            if (typeof tVal === 'string') {
                const s = tVal.trim();
                if (s === '特進' || s.toLowerCase() === 'true' || s === '1' || s === 'あり') {
                    isTokushinBool = true;
                }
            } else if (typeof tVal === 'number') {
                if (tVal === 1) isTokushinBool = true;
            } else if (typeof tVal === 'boolean') {
                isTokushinBool = tVal;
            }

            // 集計除外フラグの解析: "集計除外" "あり" "1" "true" -> true、その他 -> false
            let excludeFromCountBool = false;
            const eVal = exclude_from_count;
            if (typeof eVal === 'string') {
                const s = eVal.trim();
                if (s === '集計除外' || s.toLowerCase() === 'true' || s === '1' || s === 'あり') {
                    excludeFromCountBool = true;
                }
            } else if (typeof eVal === 'number') {
                if (eVal === 1) excludeFromCountBool = true;
            } else if (typeof eVal === 'boolean') {
                excludeFromCountBool = eVal;
            }

            upsertData.push({
                name,
                furigana: furigana || name,
                email,
                rank_id: rankId,
                term_id: termId,
                is_tokushin: isTokushinBool,
                exclude_from_count: excludeFromCountBool
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
                        // メールアドレスがない場合、更新データから除外（既存のままにする）
                        // しかし、CSVパース時にundefinedになっているはずなので、スプレッド構文で上書きされる恐れがあるか？
                        // item.email が undefined/empty string の場合、それをDBのNULLにしたくないなら、
                        // updateDataを作成する際にundefinedのフィールドを除外する必要がある。
                        // ここでは、emailがFalsyなら既存のemailを維持したい（あるいは更新しない）。

                        const updateData = { ...item };
                        if (!updateData.email) {
                            delete updateData.email; // 更新対象から外す
                        }

                        toUpdate.push({
                            id: existingMap.get(key),
                            ...updateData
                        });
                    }
                    // skipモードなら何もしない
                } else {
                    // 新規作成: メールアドレス必須
                    if (item.email) {
                        toInsert.push(item);
                    } else {
                        errors.push(`スキップ: 既存データが見つからず、メールアドレスもないため新規登録できません (氏名: ${item.name}, 期ID: ${item.term_id})`);
                    }
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
