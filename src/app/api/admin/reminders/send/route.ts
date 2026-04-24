
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
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
    if (isNaN(date.getTime())) return iso; // Return as-is if not a valid ISO date

    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const w = days[date.getDay()];
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${m}月${d}日(${w}) ${h}:${min}`;
};

// Utility to get comparable time value
const getTimeValue = (s: string) => {
    if (!s) return 9999999999999;
    const date = new Date(s);
    if (!isNaN(date.getTime())) return date.getTime();
    
    // Fallback for old text format
    const match = s.match(/(\d+)月(\d+)日/);
    if (!match) return 9999999999999;
    return parseInt(match[1]) * 100 + parseInt(match[2]);
};

export async function POST(request: Request) {
    try {
        const { ids } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        // 1. Fetch Applications
        const { data: apps, error: appsError } = await supabaseAdmin
            .from('applications')
            .select('*, members(*, ranks(*))')
            .in('id', ids);

        if (appsError || !apps) {
            return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
        }

        // 2. Fetch Settings
        const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*');
        const settings: any = {};
        settingsData?.forEach(row => {
            settings[row.key] = row.value;
        });

        // 3. Fetch Venues Master (for Area mapping)
        const { data: venuesMaster } = await supabaseAdmin.from('venues').select('*');

        const senderName = settings.sender_name || '神言学事務局';
        const senderEmail = settings.sender_email || process.env.FROM_EMAIL || 'noreply@resend.dev';
        const adminEmail = settings.admin_email;
        const adminBccEmail = settings.admin_bcc_email;

        const results = [];

        for (const app of apps) {
            try {
                const normVenue = normalizeVenue(app.venue);
                if (normVenue === '参加しない') {
                    results.push({ id: app.id, status: 'skipped', reason: 'not_attending' });
                    continue;
                }

                // Determine Area
                let area: string = 'tokyo';
                const venueName = (app.venue || '').trim();
                const pType = app.participation_type || 'venue';
                const onlineVenues = (app.online_venues || '').trim();

                const isOnline = pType === 'online' || isOnlineVenue(venueName) || isOnlineVenue(onlineVenues);

                // 1. Check master data & normalization
                const masterVenue = venuesMaster?.find(mv => mv.name === venueName && mv.type === 'lecture');
                const masterOnline = onlineVenues ? venuesMaster?.find(mv => onlineVenues.includes(mv.name) && mv.type === 'lecture') : null;

                if (normVenue === '東京・福岡' || onlineVenues.includes('東京・福岡')) {
                    area = 'both';
                } else if (masterVenue?.area === 'fukuoka' || masterOnline?.area === 'fukuoka') {
                    area = 'fukuoka';
                } else if (venueName.includes('福岡') || onlineVenues.includes('福岡') || (app.venue || '').includes('福岡')) {
                    area = 'fukuoka';
                }

                const isPaid = app.payment_status === 'paid';

                // Select Template
                let template;
                if (isOnline) {
                    template = isPaid 
                        ? (settings.email_template_reminder_online_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_PAID)
                        : (settings.email_template_reminder_online_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_UNPAID);
                } else {
                    template = isPaid
                        ? (settings.email_template_reminder_venue_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_PAID)
                        : (settings.email_template_reminder_venue_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_UNPAID);
                }

                // Prepare Variables
                const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
                const displayVenue = getVenueDisplayName(app.venue, pType, app.online_venues);
                const displaySocial = (pType === 'online') ? '参加不可' : app.social_venue;
                
                // Get Area-specific date and link
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
                    // ... (rest of date logic)
                    const tokyoDate = lectureDates.tokyo;
                    const fukuokaDate = lectureDates.fukuoka;
                    
                    const dateItems = [];
                    if (tokyoDate) dateItems.push({ label: '東京', date: tokyoDate });
                    if (fukuokaDate) dateItems.push({ label: '福岡', date: fukuokaDate });

                    // Sort chronologically
                    dateItems.sort((a, b) => {
                        return getTimeValue(a.date) - getTimeValue(b.date);
                    });

                    lectureDate = dateItems.map(item => `【${item.label}】${formatJapaneseDateTime(item.date)}`).join('\n');
                    if (!lectureDate) lectureDate = '6月7日(日)・6月14日(日)'; // Basic fallback

                    const linkItems = [];
                    if (onlineViewingLinks.tokyo) linkItems.push({ label: '東京エリア配信分', link: onlineViewingLinks.tokyo, area: '東京' });
                    if (onlineViewingLinks.fukuoka) linkItems.push({ label: '福岡エリア配信分', link: onlineViewingLinks.fukuoka, area: '福岡' });

                    // Sort links by same order as dates
                    const order = dateItems.map(i => i.label);
                    linkItems.sort((a, b) => {
                        return order.indexOf(a.area) - order.indexOf(b.area);
                    });

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

                // Payment Link (for unpaid)

                // Payment Link (for unpaid)
                let paymentUrl = '';
                if (!isPaid) {
                    const paymentLinks = settings.payment_links || [];
                    const rankId = app.members?.ranks?.id ? String(app.members.ranks.id) : null;
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

                // Send Email
                await resend.emails.send({
                    from: `${senderName} <${senderEmail}>`,
                    to: [app.input_email],
                    cc: adminEmail ? [adminEmail] : undefined,
                    bcc: adminBccEmail ? [adminBccEmail] : undefined,
                    subject: emailSubject,
                    text: emailContent,
                });

                // Add Tag
                const currentTags = app.tags || [];
                if (!currentTags.includes('reminder_sent')) {
                    const newTags = [...currentTags, 'reminder_sent'];
                    await supabaseAdmin
                        .from('applications')
                        .update({ tags: newTags })
                        .eq('id', app.id);
                }

                results.push({ id: app.id, status: 'success' });

            } catch (err: any) {
                console.error(`Error sending reminder to ${app.id}:`, err);
                results.push({ id: app.id, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (e: any) {
        console.error('Reminder API Error:', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
