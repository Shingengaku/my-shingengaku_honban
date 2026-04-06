
const { matchProduct } = require('./src/lib/venueUtils');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyIdMatching() {
    console.log('--- Final Verification: ID-Based Matching ---');
    
    const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'payment_links').single();
    const paymentLinks = settings.value;

    // Test cases for ID based matching
    const testCases = [
        { name: 'General (ID 7)', venue: '東京', social: '参加しない', type: 'venue', rank_id: '7' },
        { name: 'Introduction (ID 8)', venue: '東京', social: '参加しない', type: 'venue', rank_id: '8' },
        { name: 'Repeat (ID 2)', venue: '東京', social: '東京', type: 'venue', rank_id: '2' },
        { name: 'Online (any)', venue: 'LIVE視聴', social: '参加しない', type: 'online', rank_id: '7' }
    ];

    for (const tc of testCases) {
        const product = matchProduct(paymentLinks, {
            venue: tc.venue,
            social_venue: tc.social,
            participation_type: tc.type,
            rank_id: tc.rank_id
        });
        
        if (product) {
            console.log(`[PASS] ${tc.name} matched product ID: ${product.rank_id} (${product.name})`);
        } else {
            console.log(`[FAIL] ${tc.name} could not find a match!`);
        }
    }
}

verifyIdMatching();
