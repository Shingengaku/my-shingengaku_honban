import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMatch() {
    const { data: apps } = await supabaseAdmin.from('applications').select('*, members(*, ranks(*))').order('created_at', { ascending: false }).limit(20);
    const targetApp = apps?.find(a => a.remarks?.includes('【LIVE視聴会場】 東京・福岡') || a.remarks?.includes('【LIVE視聴会場】東京・福岡') || a.input_name.includes('池満'));

    if (!targetApp) {
        console.log('Target app not found');
        return;
    }
    console.log('Target App:', targetApp);

    const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*');
    let paymentLinks = [];
    settingsData?.forEach(row => {
        if (row.key === 'payment_links') paymentLinks = row.value;
    });

    console.log('Payment Links count:', paymentLinks.length);

    const { data: ranks } = await supabaseAdmin.from('ranks').select('id, name');

    let rankId = null;
    if (targetApp.members?.ranks?.id) {
        rankId = String(targetApp.members.ranks.id);
    } else if (targetApp.applied_rank_name) {
        const found = ranks?.find(r => r.name === targetApp.applied_rank_name);
        if (found) rankId = String(found.id);
    }

    console.log('Derived Rank ID:', rankId);

    const venue = targetApp.venue;
    const social_venue = targetApp.social_venue;
    const participation_type = targetApp.participation_type || 'venue';

    const venueDisplayMap = {
        'tokyo': '東京',
        'fukuoka': '福岡',
        'both': '両方参加',
        'none': '参加しません'
    };

    const searchVenue = venueDisplayMap[venue] || venue;
    const searchSocial = venueDisplayMap[social_venue] || social_venue;

    let onlineProductCategory = '';
    if (participation_type === 'online') {
        const matchLive = /【LIVE視聴会場】\s*([^\n]+)/.exec(targetApp.remarks || '');
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

    console.log('Matching details:', { venue, searchVenue, social_venue, searchSocial, participation_type, onlineProductCategory, rankId });

    const matchedProduct = paymentLinks.find(p => {
        const venueMatch = (p.venue_lecture === venue) ||
            (p.venue_lecture === searchVenue) ||
            (onlineProductCategory !== '' && p.venue_lecture === onlineProductCategory) ||
            (venue === 'both' && (p.venue_lecture === '東京・福岡' || p.venue_lecture === '福岡・東京'));

        let socialMatch = (p.venue_social === social_venue) ||
            (p.venue_social === searchSocial) ||
            (social_venue === 'both' && (p.venue_social === '東京・福岡' || p.venue_social === '福岡・東京'));

        if (participation_type === 'online' && p.venue_social === 'ー') {
            socialMatch = true;
        }

        const rankName = targetApp.applied_rank_name || targetApp.members?.ranks?.name || '一般';
        const rankMatch = rankId
            ? ((p.rank_id && String(p.rank_id) === String(rankId)) || (!p.rank_id && p.name && p.name.includes(rankName)))
            : !p.rank_id;

        if (venueMatch && socialMatch && rankMatch) {
            console.log('MATCHED:', p.name);
            return true;
        }

        // Let's print products that match rank to see why venue/social fails
        if (rankMatch && (p.venue_lecture?.includes('LIVE') || p.name?.includes('LIVE'))) {
            console.log('Close match failed:', p.name, ' | p.venue_lecture:', p.venue_lecture, ' | p.venue_social:', p.venue_social, ' | vMatch:', venueMatch, ' sMatch:', socialMatch, ' rMatch:', rankMatch);
        }

        return false;
    }) || null;

    console.log('Matched Product:', matchedProduct);
}
testMatch().catch(console.error);
