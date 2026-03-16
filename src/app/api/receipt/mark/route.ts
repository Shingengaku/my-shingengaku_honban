import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, type, tags, is_admin } = body;

        // type: 'receipt_issued' | 'receipt_issued_lecture' | 'receipt_issued_social' | 'invoice_issued' | 'invoice_issued_lecture' | 'invoice_issued_social'
        if (!id || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const tagMap: Record<string, string> = {
            'receipt_issued': 'receipted',
            'receipt_issued_lecture': 'receipted_lecture',
            'receipt_issued_social': 'receipted_social',
            'invoice_issued': 'invoiced',
            'invoice_issued_lecture': 'invoiced_lecture',
            'invoice_issued_social': 'invoiced_social'
        };

        const tagToAdd = tagMap[type];
        if (!tagToAdd) {
            return NextResponse.json({ error: 'Invalid type format' }, { status: 400 });
        }

        // 現在のアプリケーションデータを取得
        const { data: currentData, error: fetchError } = await supabaseAdmin
            .from('applications')
            .select('tags')
            .eq('id', id)
            .single();

        if (fetchError || !currentData) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 });
        }

        let currentTags: string[] = currentData.tags || [];

        // 【要件】お客様からの操作で、既にその種類のタグが付いている場合はエラー（再発行不可）にする
        if (!is_admin) {
            // 合算で発行しようとしているのに、すでに合算で発行済みの場合はブロック
            if (currentTags.includes(tagToAdd)) {
                return NextResponse.json({ 
                    error: 'ALREADY_ISSUED',
                    message: '既に発行済みです。再発行が必要な場合は管理者へお問い合わせください。'
                }, { status: 403 });
            }
            // 単独で発行しようとしているのに、すでに「合算」で発行済みの場合はブロック
            if ((tagToAdd.includes('_lecture') || tagToAdd.includes('_social')) && currentTags.includes(tagToAdd.split('_')[0])) {
                return NextResponse.json({ 
                    error: 'ALREADY_ISSUED',
                    message: '既に合算での書類が発行済みです。分割発行や再発行が必要な場合は管理者へお問い合わせください。'
                }, { status: 403 });
            }
            // 合算で発行しようとしているのに、すでに「単独」で何らか発行済みの場合はブロック
            if ((tagToAdd === 'receipted' || tagToAdd === 'invoiced') && (currentTags.includes(tagToAdd + '_lecture') || currentTags.includes(tagToAdd + '_social'))) {
                return NextResponse.json({ 
                    error: 'ALREADY_ISSUED',
                    message: '既に内訳を分割した書類が発行済みです。合算での発行や再発行が必要な場合は管理者へお問い合わせください。'
                }, { status: 403 });
            }
        }

        // タグ更新処理 (管理者の場合、明示的にタグ配列が送られてくる場合と、追加のみの場合がある)
        let newTags = [...currentTags];
        if (tags !== undefined && Array.isArray(tags)) {
            // 管理者がタグ一覧を直接指定して上書きする場合
            newTags = tags;
        } else {
            if (!newTags.includes(tagToAdd)) {
                newTags.push(tagToAdd);
            }
        }

        // update
        const { data: updatedData, error: updateError } = await supabaseAdmin
            .from('applications')
            .update({ tags: newTags })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json(updatedData);

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
