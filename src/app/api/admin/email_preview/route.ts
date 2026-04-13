import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_TEMPLATE_GENERAL, DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION, processEmailTemplate } from '@/lib/emailTemplate';
import { normalizeVenue, getVenueDisplayName, matchProduct } from '@/lib/venueUtils';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        // 1. 申込データと設定、ランクを取得
        const [appRes, settingsRes, ranksRes, termsRes] = await Promise.all([
            supabaseAdmin.from('applications').select('*, members(*, ranks(*))').eq('id', id).single(),
            supabaseAdmin.from('app_settings').select('*'),
            supabaseAdmin.from('ranks').select('id, name'),
            supabaseAdmin.from('terms').select('id, name')
        ]);

        if (appRes.error || !appRes.data) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }
        const app = appRes.data;

        const settings: any = {};
        settingsRes.data?.forEach(row => {
            if (row.key === 'payment_links') settings.payment_links = row.value;
            if (row.key === 'admin_email') settings.admin_email = row.value;
            if (row.key === 'admin_bcc_email') settings.admin_bcc_email = row.value;
            if (row.key === 'email_template') settings.email_template = row.value;
            if (row.key === 'email_template_general') settings.email_template_general = row.value;
            if (row.key === 'email_template_free') settings.email_template_free = row.value;
            if (row.key === 'email_template_free_online') settings.email_template_free_online = row.value;
        });

        const ranks = ranksRes.data || [];
        const paymentLinks = settings.payment_links || [];

        // 2. ランクIDの特定
        let rankId: string | null = null;
        if (app.members?.ranks?.id) {
            rankId = String(app.members.ranks.id);
        } else if (app.applied_rank_name) {
            const found = ranks.find(r => r.name === app.applied_rank_name);
            if (found) rankId = String(found.id);
        }
        const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';

        // 3. 商品マッチング (共通ユーティリティを使用)
        const matchedProduct = matchProduct(paymentLinks, {
            venue: app.venue,
            social_venue: app.social_venue,
            participation_type: app.participation_type || 'venue',
            online_venues: app.online_venues,
            rank_id: rankId,
            rank_name: rankName,
            payment_key: app.payment_key
        });

        const totalAmount = matchedProduct ? (Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)) : 0;
        const paymentUrl = matchedProduct?.url || null;

        // 4. テンプレート選択
        let template;
        if (app.venue === '参加しない') {
            template = DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION;
        } else if (totalAmount === 0 && matchedProduct) {
            const dbTemplateVenue = settings.email_template_free;
            const dbTemplateOnline = settings.email_template_free_online;
            let dbTemplate = (app.participation_type === 'online' && dbTemplateOnline?.subject) ? dbTemplateOnline : dbTemplateVenue;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : {
                subject: '【神言学】お申込み受付完了のお知らせ',
                body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n当日は会場にてお待ちしております。`
            };
        } else if (matchedProduct) {
            const dbTemplate = settings.email_template;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE;
        } else {
            const dbTemplate = settings.email_template_general;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE_GENERAL;
        }

        // 5. 表示用文字列
        let displayVenue = getVenueDisplayName(app.venue, app.participation_type, app.online_venues);
        let displaySocialVenue = (app.participation_type === 'online') ? '参加不可' : app.social_venue;

        // 個別金額の付加
        if (matchedProduct) {
            const lectureFee = Number(matchedProduct.lecture_fee) || 0;
            displayVenue += `（${lectureFee.toLocaleString()}円）`;
            const socialFee = Number(matchedProduct.social_fee) || 0;
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
            amount: totalAmount.toLocaleString(),
            payment_link_section: (matchedProduct && paymentUrl) ? paymentUrl : '',
            // リマインド用変数のフォールバック（プレビュー時）
            lecture_date: '（開催日時）',
            viewing_link: '（オンライン視聴URL）'
        };

        const content = processEmailTemplate(template.body, vars);

        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // CCとBCCが同じ場合はBCCから除外する
        let bccList = adminBccEmail;
        if (adminEmail && adminBccEmail && adminEmail.toLowerCase() === adminBccEmail.toLowerCase()) {
            bccList = undefined;
        }

        return NextResponse.json({
            subject: template.subject,
            content,
            email: app.input_email,
            cc: adminEmail || undefined,
            bcc: bccList || undefined,
            debug: {
                totalAmount,
                hasProduct: !!matchedProduct,
                productName: matchedProduct?.name,
                templateType: (totalAmount === 0 && matchedProduct) ? 'free' : (matchedProduct ? 'payment' : 'general')
            }
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
