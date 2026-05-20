import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, parent_application_id, child_application_ids } = body;

        if (!type || (type !== 'link' && type !== 'unlink')) {
            return NextResponse.json({ error: 'Invalid type. Use "link" or "unlink".' }, { status: 400 });
        }

        if (!child_application_ids || !Array.isArray(child_application_ids) || child_application_ids.length === 0) {
            return NextResponse.json({ error: 'child_application_ids must be a non-empty array' }, { status: 400 });
        }

        if (type === 'link') {
            if (!parent_application_id) {
                return NextResponse.json({ error: 'parent_application_id is required for link type' }, { status: 400 });
            }

            // 1. 代表者（親）レコードの決済ステータスを取得
            const { data: parentApp, error: parentError } = await supabaseAdmin
                .from('applications')
                .select('payment_status')
                .eq('id', parent_application_id)
                .single();

            if (parentError || !parentApp) {
                return NextResponse.json({ error: 'Parent application not found' }, { status: 404 });
            }

            // 2. 子レコードの parent_application_id と payment_status を更新（同期）
            const { error: linkError } = await supabaseAdmin
                .from('applications')
                .update({ 
                    parent_application_id: parent_application_id,
                    payment_status: parentApp.payment_status 
                })
                .in('id', child_application_ids);

            if (linkError) throw linkError;

            console.log(`Successfully linked applications ${child_application_ids.join(', ')} to parent ${parent_application_id}`);
            return NextResponse.json({ success: true });
        }

        if (type === 'unlink') {
            // 子レコードの parent_application_id を null に更新して紐付けを解除
            const { error: unlinkError } = await supabaseAdmin
                .from('applications')
                .update({ parent_application_id: null })
                .in('id', child_application_ids);

            if (unlinkError) throw unlinkError;

            console.log(`Successfully unlinked applications ${child_application_ids.join(', ')}`);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });

    } catch (e: any) {
        console.error('Link Handler Error:', e);
        return NextResponse.json({
            error: 'Server Error',
            details: e?.message || JSON.stringify(e, null, 2)
        }, { status: 500 });
    }
}
