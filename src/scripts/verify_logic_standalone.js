
// ---------------------------------------------------------
// Standalone Verify logic: matchProduct
// ---------------------------------------------------------
function normalizeVenue(v) {
    if (!v) return '参加しない';
    if (v === 'tokyo') return '東京';
    if (v === 'fukuoka') return '福岡';
    if (v === 'both' || v === '両方参加') return '東京・福岡';
    if (v === 'none' || v === '参加しません') return '参加しない';
    if (v === 'LIVE視聴（2会場）' || v === 'LIVE視聴(2会場)') return 'LIVE視聴';
    return v;
}

function matchProduct(paymentLinks, appData) {
    const normalizedVenue = normalizeVenue(appData.venue);
    const normalizedSocial = normalizeVenue(appData.social_venue);
    const participationType = appData.participation_type || 'venue';

    return paymentLinks.find(p => {
        let venueMatch = false;
        if (participationType === 'online') {
            venueMatch = (p.venue_lecture === 'LIVE視聴');
        } else {
            venueMatch = (p.venue_lecture === normalizedVenue);
        }

        let socialMatch = false;
        if (participationType === 'online') {
            socialMatch = (p.venue_social === 'ー');
        } else {
            socialMatch = (p.venue_social === normalizedSocial);
        }

        // 新しい厳格なIDマッチングロジック
        const rankMatch = String(p.rank_id) === String(appData.rank_id);

        return venueMatch && socialMatch && rankMatch;
    }) || null;
}

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    console.log('--- Final Logic Check: ID-Based Match ---');
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    const links = settings.value;

    const tests = [
        { label: 'General (ID 7)', venue: '東京', social: '参加しない', type: 'venue', rank_id: '7' },
        { label: 'Introduction (ID 8)', venue: '福岡', social: '参加しない', type: 'venue', rank_id: '8' },
        { label: 'Repeat (ID 2)', venue: '東京', social: '東京', type: 'venue', rank_id: '2' },
        { label: 'Online Tokyo (ID 7)', venue: 'LIVE視聴', social: '参加しない', type: 'online', rank_id: '7' },
        { label: 'Online Both (ID 7)', venue: 'LIVE視聴', social: '参加しない', type: 'online', rank_id: '7' }
    ];

    tests.forEach(t => {
        const p = matchProduct(links, t);
        if (p) {
            console.log(`[PASS] ${t.label} -> ${p.name}`);
        } else {
            console.log(`[FAIL] ${t.label} -> No match! (Check IDs)`);
        }
    });
}

verify();
