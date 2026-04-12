
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
                // Skip cancelled
                if (app.payment_status === 'cancelled') {
                    results.push({ id: app.id, status: 'skipped', reason: 'cancelled' });
                    continue;
                }

                // Determine Area
                let area: string = 'tokyo'; // Default
                const venueName = app.venue || '';
                const pType = app.participation_type || 'venue';
                
                // Try finding in master
                const masterVenue = venuesMaster?.find(mv => mv.name === venueName && mv.type === 'lecture');
                if (masterVenue?.area && ['tokyo', 'fukuoka'].includes(masterVenue.area)) {
                    area = masterVenue.area;
                } else if (venueName.includes('福岡')) {
                    area = 'fukuoka';
                } else if (app.online_venues?.includes('福岡')) {
                    area = 'fukuoka';
                }

                const isPaid = app.payment_status === 'paid';
                const isOnline = pType === 'online' || isOnlineVenue(venueName);

                // Select Template
                let template;
                if (isOnline) {
                    template = isPaid 
                        ? (settings.email_template_reminder_online_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_PAID)
                        : (settings.email_template_reminder_online_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_UNPAID);
                } else {
                    template = isPaid
                        ? (settings.email_template_reminder_reminder_venue_paid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_PAID)
                        : (settings.email_template_reminder_reminder_venue_unpaid || DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_UNPAID);
                }

                // Prepare Variables
                const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
                const displayVenue = getVenueDisplayName(app.venue, pType, app.online_venues);
                const displaySocial = (pType === 'online') ? '参加不可' : app.social_venue;
                
                // Get Area-specific date and link
                const lectureDates = settings.lecture_dates || {};
                const viewingLinks = settings.online_viewing_links || {};
                const lectureDate = lectureDates[area] || (area === 'tokyo' ? '6月14日(日)' : '6月7日(日)');
                const viewingLink = viewingLinks[area] || '';

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
                    amount: app.total_amount.toLocaleString(),
                    payment_link_section: paymentUrl,
                    lecture_date: lectureDate,
                    viewing_link: viewingLink
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
