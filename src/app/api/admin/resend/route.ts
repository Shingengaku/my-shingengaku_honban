
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { processEmailTemplate, DEFAULT_EMAIL_TEMPLATE_RESEND, DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION } from '@/lib/emailTemplate';
import { normalizeVenue, getVenueDisplayName, matchProduct } from '@/lib/venueUtils';

export async function POST(request: Request) {
    try {
        const { id, subject: customSubject, body: customBody, additionalEmail, sendToOriginal = true } = await request.json();

        // 1. 申込データ取得
        const { data: app, error } = await supabaseAdmin
            .from('applications')
            .select('*, members(*, ranks(*))')
            .eq('id', id)
            .single();

        if (error || !app) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }

        // 2. 設定およびランクマスタ取得
        const [settingsDataRes, ranksDataRes] = await Promise.all([
            supabaseAdmin.from('app_settings').select('*'),
            supabaseAdmin.from('ranks').select('id, name')
        ]);
        
        const settingsData = settingsDataRes.data;
        const ranks = ranksDataRes.data || [];

        const settings: any = {};
        settingsData?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
            if (row.key === 'email_template_resend') settings.email_template_resend = row.value;
        });

        const paymentLinks = settings.payment_links || [];
        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // 3. 商品マッチング (共通ユーティリティを使用)
        const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
        let rankId: string | null = null;
        if (app.members?.ranks?.id) {
            rankId = String(app.members.ranks.id);
        } else if (app.applied_rank_name) {
            const found = ranks.find(r => r.name === app.applied_rank_name);
            if (found) rankId = String(found.id);
        }

        const paymentLink = matchProduct(paymentLinks, {
            venue: app.venue,
            social_venue: app.social_venue,
            participation_type: app.participation_type || 'venue',
            online_venues: app.online_venues,
            rank_id: rankId,
            rank_name: rankName,
            payment_key: app.payment_key
        });

        const paymentUrl = paymentLink?.url || '';

        // テンプレート選択
        let template = settings.email_template_resend || DEFAULT_EMAIL_TEMPLATE_RESEND;
        if (app.venue === '参加しない') {
            template = DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION;
        }

        // 5. 表示用文字列
        let displayVenue = getVenueDisplayName(app.venue, app.participation_type, app.online_venues);
        let displaySocialVenue = (app.participation_type === 'online') ? '参加不可' : app.social_venue;

        // 個別金額の付加
        if (paymentLink) {
            const lectureFee = Number(paymentLink.lecture_fee) || 0;
            displayVenue += `（${lectureFee.toLocaleString()}円）`;
            const socialFee = Number(paymentLink.social_fee) || 0;
            if (app.participation_type !== 'online' && app.social_venue !== '参加しない') {
                displaySocialVenue += `（${socialFee.toLocaleString()}円）`;
            }
        } else {
            if (app.venue === '参加しない') displayVenue += `（0円）`;
            if (app.social_venue === '参加しない' && app.participation_type !== 'online') displaySocialVenue += `（0円）`;
        }

        const vars = {
            name: app.input_name,
            rank: rankName,
            venue: displayVenue,
            social_venue: displaySocialVenue,
            amount: app.total_amount.toLocaleString(),
            payment_link_section: paymentUrl ? paymentUrl : ''
        };

        const emailSubject = customSubject || template.subject;
        const emailContent = customBody || processEmailTemplate(template.body, vars);

        // CC/BCC ロジック：全体設定を常に使用
        let finalBcc = adminBccEmail ? [adminBccEmail] : undefined;
        if (adminEmail && adminBccEmail && adminEmail.toLowerCase() === adminBccEmail.toLowerCase()) {
            finalBcc = undefined;
        }

        // 送信先リストの構築
        const toList: string[] = [];
        if (sendToOriginal !== false) {
            toList.push(app.input_email);
        }
        if (additionalEmail && additionalEmail.trim()) {
            const trimmed = additionalEmail.trim();
            if (!toList.includes(trimmed)) {
                toList.push(trimmed);
            }
        }
        // 安全策: 送信先が空にならないようにする
        if (toList.length === 0) {
            toList.push(app.input_email);
        }

        const fromEmail = process.env.FROM_EMAIL || 'noreply@resend.dev';
        await resend.emails.send({
            from: `神言学事務局 <${fromEmail}>`,
            to: toList,
            cc: adminEmail ? [adminEmail] : undefined,
            bcc: finalBcc,
            subject: emailSubject,
            text: emailContent,
        });

        // 追加送信先をDBに保存（永続化）
        if (additionalEmail !== undefined) {
            try {
                await supabaseAdmin
                    .from('applications')
                    .update({ additional_email: additionalEmail.trim() || null })
                    .eq('id', id);
            } catch (saveErr) {
                // カラムが存在しない場合でも送信自体は成功しているのでエラーにしない
                console.warn('Failed to save additional_email (column may not exist):', saveErr);
            }
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
