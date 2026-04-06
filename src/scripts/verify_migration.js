
const { matchProduct, normalizeVenue } = require('./src/lib/venueUtils');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyMigration() {
    console.log('--- Verification: Payment Link Consistency ---');
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    const paymentLinks = settings.value;

    const testCases = [
        { name: 'Tokyo Venue', venue: '東京', social: '東京', type: 'venue', rank: '一般' },
        { name: 'Fukuoka Venue', venue: '福岡', social: '福岡', type: 'venue', rank: '一般' },
        { name: 'Both Venue', venue: '東京・福岡', social: '東京・福岡', type: 'venue', rank: '一般' },
        { name: 'Online (Tokyo)', venue: '東京', social: '参加しない', type: 'online', online_venues: '東京', rank: '一般' },
        { name: 'Online (Both)', venue: '東京・福岡', social: '参加しない', type: 'online', online_venues: '東京・福岡', rank: '一般' }
    ];

    for (const tc of testCases) {
        const product = matchProduct(paymentLinks, {
            venue: tc.venue,
            social_venue: tc.social,
            participation_type: tc.type,
            online_venues: tc.online_venues,
            rank_name: tc.rank
        });
        console.log(`Test [${tc.name}]: ${product ? 'MATCHED: ' + product.name : 'FAILED'}`);
    }

    console.log('\n--- Verification: Database Records ---');
    const { data: apps } = await supabase.from('applications').select('venue, social_venue, online_venues').limit(5);
    console.log('Sample Apps (should be Japanese):');
    console.log(apps);
}

// simulate require for local testing without transpilation
verifyMigration();
