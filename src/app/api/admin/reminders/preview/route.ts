import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { 
    processEmailTemplate, 
    DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_PAID, 
    DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_UNPAID,
    DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_PAID,
    DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_UNPAID
} from '@/lib/emailTemplate';
import { normalizeVenue, getVenueDisplayName, matchProduct, isOnlineVenue } from '@/lib/venueUtils';

// Utility to format ISO string to Japanese date-time
const formatJapaneseDateTime = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const w = days[date.getDay()];
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${m}月${d}日(${w}) ${h}:${min}`;
};

const getTimeValue = (s: string) => {
    if (!s) return 9999999999999;
    const date = new Date(s);
    if (!isNaN(date.getTime())) return date.getTime();
    
    const match = s.match(/(\d+)月(\d+)日/);
    if (!match) return 9999999999999;
    return parseInt(match[1]) * 100 + parseInt(match[2]);
};

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
        }

        const [appRes, settingsRes, venuesRes, ranksRes] = await Promise.all([
            supabaseAdmin.from('applications').select('*, members(*, ranks(*))').eq('id', id).single(),
            supabaseAdmin.from('app_settings').select('*'),
            supabaseAdmin.from('venues').select('*'),
            supabaseAdmin.from('ranks').select('id, name')
        ]);

        if (appRes.error || !appRes.data) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }
        const app = appRes.data;

        const settings: any = {};
        settingsRes.data?.forEach(row => {
            settings[row.key] = row.value;
        });

        const venuesMaster = venuesRes.data || [];
        const ranks = ranksRes.data || [];

        const normVenue = normalizeVenue(app.venue);
        if (normVenue === '参加しない') {
            return NextResponse.json({ 
                error: 'この参加者は「参加しない」ため、リマインドの送信対象外です。',
                subject: '', content: '', email: app.input_email, isError: true
            });
        }

        let area: string = 'tokyo';
        const venueName = (app.venue || '').trim();
        const pType = app.participation_type || 'venue';
        const onlineVenues = (app.online_venues || '').trim();

        const isOnline = pType === 'online' || isOnlineVenue(venueName) || isOnlineVenue(onlineVenues);

        const masterVenue = venuesMaster?.find(mv => mv.name === venueName && mv.type === 'lecture');
        const masterOnline = onlineVenues ? venuesMaster?.find(mv => onlineVenues.includes(mv.name) && mv.type === 'lecture') : null;

        if (normVenue === '東京・福岡' || onlineVenues.includes('東京・福岡')) {
            area = 'both';
        } else if (masterVenue?.area === 'fukuoka' || masterOnline?.area === 'fukuoka') {
            area = 'fukuoka';
        } else if (venueName.includes('福岡') || onlineVenues.includes('福岡') || (app.venue || '').includes('福岡')) {
            area = 'fukuoka';
        }

        const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
        let rankId: string | null = null;
        if (app.members?.ranks?.id) {
            rankId = String(app.members.ranks.id);
        } else if (app.applied_rank_name) {
            const found = ranks.find(r => r.name === app.applied_rank_name);
            if (found) rankId = String(found.id);
        }

        const isAlert = app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert');
        const isPaidOrFree = app.payment_status === 'paid' || (app.total_amount === 0 && app.payment_status !== 'cancelled' && !isAlert);

        let template;
        if (isOnline) {
            template = isPaidOrFree 
                ? (settings.email_template_reminder_online_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_PAID)
                : (settings.email_template_reminder_online_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_UNPAID);
        } else {
            template = isPaidOrFree
                ? (settings.email_template_reminder_venue_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_PAID)
                : (settings.email_template_reminder_venue_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_UNPAID);
        }

        const displayVenue = getVenueDisplayName(app.venue, pType, app.online_venues);
        const displaySocial = (pType === 'online') ? '参加不可' : app.social_venue;
        
        const lectureDates = settings.lecture_dates || {};
        const onlineViewingLinks = settings.online_viewing_links || {};
        const zoomIds = settings.zoom_ids || {};
        const zoomPasses = settings.zoom_passes || {};
        
        let lectureDate = '';
        let viewingLink = '';
        let zoomId = '';
        let zoomPass = '';
        let zoomInfo = '';

        if (area === 'both') {
            const tokyoDate = lectureDates.tokyo;
            const fukuokaDate = lectureDates.fukuoka;
            
            const dateItems = [];
            if (tokyoDate) dateItems.push({ label: '東京', date: tokyoDate });
            if (fukuokaDate) dateItems.push({ label: '福岡', date: fukuokaDate });

            dateItems.sort((a, b) => getTimeValue(a.date) - getTimeValue(b.date));

            lectureDate = dateItems.map(item => `【${item.label}】${formatJapaneseDateTime(item.date)}`).join('\n');
            if (!lectureDate) lectureDate = '6月7日(日)・6月14日(日)';

            const linkItems = [];
            if (onlineViewingLinks.tokyo) linkItems.push({ label: '東京エリア配信分', link: onlineViewingLinks.tokyo, area: '東京' });
            if (onlineViewingLinks.fukuoka) linkItems.push({ label: '福岡エリア配信分', link: onlineViewingLinks.fukuoka, area: '福岡' });

            const order = dateItems.map(i => i.label);
            linkItems.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));

            viewingLink = linkItems.map(item => `【${item.label}】${item.link}`).join('\n');

            const zoomIdItems = [];
            if (zoomIds.tokyo) zoomIdItems.push(`東京：${zoomIds.tokyo}`);
            if (zoomIds.fukuoka) zoomIdItems.push(`福岡：${zoomIds.fukuoka}`);
            zoomId = zoomIdItems.join(' / ');

            const zoomPassItems = [];
            if (zoomPasses.tokyo) zoomPassItems.push(`東京：${zoomPasses.tokyo}`);
            if (zoomPasses.fukuoka) zoomPassItems.push(`福岡：${zoomPasses.fukuoka}`);
            zoomPass = zoomPassItems.join(' / ');

            const zoomInfoItems = [];
            for (const item of dateItems) {
                const areaKey = item.label === '東京' ? 'tokyo' : 'fukuoka';
                if (zoomIds[areaKey] || zoomPasses[areaKey]) {
                    zoomInfoItems.push(`【${item.label}】\nZOOM ID：${zoomIds[areaKey] || '（別途案内）'}\nパスワード：${zoomPasses[areaKey] || '（なし）'}`);
                }
            }
            zoomInfo = zoomInfoItems.join('\n\n');

        } else {
            const areaLabel = area === 'tokyo' ? '東京' : '福岡';
            lectureDate = `【${areaLabel}】${formatJapaneseDateTime(lectureDates[area]) || (area === 'tokyo' ? '6月14日(日)' : '6月7日(日)')}`;
            viewingLink = onlineViewingLinks[area] || '';
            zoomId = zoomIds[area] ? `${areaLabel}：${zoomIds[area]}` : '';
            zoomPass = zoomPasses[area] ? `${areaLabel}：${zoomPasses[area]}` : '';
            
            if (zoomIds[area] || zoomPasses[area]) {
                zoomInfo = `【${areaLabel}】\nZOOM ID：${zoomIds[area] || '（別途案内）'}\nパスワード：${zoomPasses[area] || '（なし）'}`;
            }
        }

        if (isOnline && !viewingLink) {
            viewingLink = '※別途ご連絡します。';
        }

        let paymentUrl = '';
        let isError = false;
        let errorMessage = '';

        if (!isPaidOrFree) {
            const paymentLinks = settings.payment_links || [];
            const matchedProduct = matchProduct(paymentLinks, {
                venue: app.venue,
                social_venue: app.social_venue,
                participation_type: pType,
                online_venues: app.online_venues,
                rank_id: rankId,
                rank_name: rankName,
                payment_key: app.payment_key
            });
            paymentUrl = matchedProduct?.url || '';

            if (!paymentUrl) {
                isError = true;
                errorMessage = '【エラー】決済リンクが見つかりません。マスタ設定をご確認ください。';
            }
        }

        const vars = {
            name: app.input_name,
            rank: rankName,
            venue: displayVenue,
            social_venue: displaySocial,
            amount: (app.total_amount || 0).toLocaleString(),
            payment_link_section: paymentUrl,
            lecture_date: lectureDate,
            viewing_link: viewingLink,
            zoom_id: zoomId,
            zoom_pass: zoomPass,
            zoom_info: zoomInfo
        };

        const emailSubject = processEmailTemplate(template.subject, vars);
        const emailContent = processEmailTemplate(template.body, vars);

        return NextResponse.json({
            subject: emailSubject,
            content: emailContent,
            email: app.input_email,
            isError,
            error: errorMessage
        });

    } catch (e) {
        console.error('Preview API Error:', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
