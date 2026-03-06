require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: apps, error } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching applications:', error);
        return;
    }

    if (!apps) {
        console.error('No apps returned');
        return;
    }

    const app = apps.find(a => a.input_name.includes('松本') && a.venue.includes('LIVE'));

    if (!app) {
        console.log('App not found. Recent apps:', apps.map(a => `${a.input_name} ${a.venue}`));
        return;
    }

    console.log('Found App:', app.input_name, app.venue, app.social_venue, app.applied_rank_name, app.remarks);

    const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_links');

    const paymentLinks = settings[0].value;

    const matchedProduct = paymentLinks.find(p => {
        const venueMatch = p.venue_lecture === app.venue;
        const socialMatch = p.venue_social === app.social_venue || (app.participation_type === 'online' && p.venue_social === 'ー');

        // Match condition similar to apply/route.ts
        let effectiveVenue = app.venue;
        const matchLive = /【LIVE視聴会場】\s*([^\n]+)/.exec(app.remarks || '');
        if (app.participation_type === 'online' && matchLive) {
            effectiveVenue = matchLive[1].trim();
        }

        const applyVenueMatch = p.venue_lecture === effectiveVenue;

        if (p.venue_lecture.includes('LIVE')) {
            console.log(`Product: ${p.name}, venue_lecture: "${p.venue_lecture}", app.venue: "${app.venue}", effectiveVenue: "${effectiveVenue}"`);
            console.log(` -> venueMatch(preview): ${venueMatch}, applyVenueMatch(apply): ${applyVenueMatch}`);
        }

        return venueMatch && socialMatch;
    });

}
check();
