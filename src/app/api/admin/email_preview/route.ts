import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPaymentKey } from '@/lib/payment';
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_TEMPLATE_GENERAL, DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION, processEmailTemplate } from '@/lib/emailTemplate';

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

        // 3. 商品マッチング (apply/route.tsと同様のロジック)
        const venue = app.venue;
        const social_venue = app.social_venue;
        const participation_type = app.participation_type || 'venue';

        const venueDisplayMap: Record<string, string> = {
            'tokyo': '東京',
            'fukuoka': '福岡',
            'both': '両方参加',
            'none': '参加しません'
        };

        const searchVenue = venueDisplayMap[venue] || venue;
        const searchSocial = venueDisplayMap[social_venue] || social_venue;

        let matchedProduct = null;
        if (Array.isArray(paymentLinks)) {
            // まずは `app.payment_key` でマッチするか試行
            if (app.payment_key) {
                matchedProduct = paymentLinks.find((p: any) => p.name === app.payment_key || p.key === app.payment_key) || null;
            }

            // payment_key で見つからない場合は従来の条件でマッチング
            if (!matchedProduct) {
                let onlineProductCategory = '';
                if (participation_type === 'online') {
                    const matchLive = /【LIVE視聴会場】\s*([^\n]+)/.exec(app.remarks || '');
                    if (matchLive) {
                        const liveVenues = matchLive[1].trim();
                        if (liveVenues.includes('・')) {
                            onlineProductCategory = 'LIVE視聴（2会場）';
                        } else {
                            onlineProductCategory = 'LIVE視聴';
                        }
                    } else {
                        onlineProductCategory = 'LIVE視聴';
                    }
                }

                matchedProduct = paymentLinks.find((p: any) => {
                    const venueMatch = (p.venue_lecture === venue) ||
                        (p.venue_lecture === searchVenue) ||
                        (onlineProductCategory !== '' && p.venue_lecture === onlineProductCategory) ||
                        (venue === 'both' && (p.venue_lecture === '東京・福岡' || p.venue_lecture === '福岡・東京'));

                    let socialMatch = (p.venue_social === social_venue) ||
                        (p.venue_social === searchSocial) ||
                        (social_venue === 'both' && (p.venue_social === '東京・福岡' || p.venue_social === '福岡・東京'));

                    // オンライン参加の特例
                    if (participation_type === 'online' && p.venue_social === 'ー') {
                        socialMatch = true;
                    }

                    const rankMatch = (rankId ? String(p.rank_id) === rankId : !p.rank_id);

                    return venueMatch && socialMatch && rankMatch;
                }) || null;
            }
        }

        const totalAmount = matchedProduct ? (Number(matchedProduct.lecture_fee) + Number(matchedProduct.social_fee)) : 0;
        const paymentUrl = matchedProduct?.url || null;

        // 4. テンプレート選択
        let template;
        if (venue === 'none' || venue === '参加しない' || app.venue === 'none' || app.venue === '参加しない') {
            template = DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION;
        } else if (totalAmount === 0 && matchedProduct) {
            // 0円かつ商品あり -> 無料テンプレート
            const dbTemplateVenue = settings.email_template_free;
            const dbTemplateOnline = settings.email_template_free_online;

            let dbTemplate = dbTemplateVenue;
            if (participation_type === 'online' && dbTemplateOnline && dbTemplateOnline.subject) {
                dbTemplate = dbTemplateOnline;
            }

            if (dbTemplate && dbTemplate.subject) {
                template = dbTemplate;
            } else {
                template = {
                    subject: '【神言学】お申込み受付完了のお知らせ',
                    body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n当日は会場にてお待ちしております。`
                };
            }
        } else if (matchedProduct) {
            // 有料商品あり
            const dbTemplate = settings.email_template;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE;
        } else {
            // 商品なし -> 一般
            const dbTemplate = settings.email_template_general;
            template = (dbTemplate && dbTemplate.subject) ? dbTemplate : DEFAULT_EMAIL_TEMPLATE_GENERAL;
        }

        // 5. 変数展開
        // 表示用文字列
        let displayVenue = venueDisplayMap[venue] || venue;
        let displaySocialVenue = venueDisplayMap[social_venue] || social_venue;
        if (participation_type === 'online') {
            const match = /【LIVE視聴会場】\s*([^\n]+)/.exec(app.remarks || '');
            if (match) {
                const liveVenue = match[1].trim();
                if (liveVenue) {
                    if (!displayVenue) {
                        displayVenue = liveVenue.includes('・') ? 'LIVE視聴（2会場）' : 'LIVE視聴';
                    }
                    if (!displayVenue.includes(`(${liveVenue})`)) {
                        displayVenue = `${displayVenue} (${liveVenue})`;
                    }
                }
            }
            displaySocialVenue = 'ー';
        }

        const paymentLinkSection = (matchedProduct && paymentUrl) ? paymentUrl : '';

        const vars = {
            name: app.input_name,
            rank: app.applied_rank_name || '一般',
            venue: displayVenue,
            social_venue: displaySocialVenue,
            amount: totalAmount.toLocaleString(),
            payment_link_section: paymentLinkSection
        };

        const content = processEmailTemplate(template.body, vars);

        const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL;
        const adminBccEmail = settings.admin_bcc_email || process.env.ADMIN_BCC_EMAIL;

        // 個別設定があれば優先
        const ccList = app.cc_email !== null ? app.cc_email : adminEmail;
        const bccList = app.bcc_email !== null ? app.bcc_email : adminBccEmail;

        return NextResponse.json({
            subject: template.subject,
            content,
            email: app.input_email,
            cc: ccList || undefined,
            bcc: bccList || undefined,
            // デバッグ用情報
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
