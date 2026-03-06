
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve('.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
}

loadEnv();

async function run() {
    console.log('--- Targeted Debugging ---');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Rank ID for "リピート"
    const { data: rank, error: rankError } = await supabase
        .from('ranks')
        .select('*')
        .eq('name', 'リピート')
        .single();

    if (rankError) {
        console.log('Rank "リピート" lookup error:', rankError.message);
    } else {
        console.log('Rank "リピート":', rank);
    }

    // 2. Search Payment Links
    const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_links')
        .single();

    if (settings && settings.value) {
        const links = settings.value;
        console.log(`Total Payment Links: ${links.length}`);

        // Filter for relevant venues
        const relevant = links.filter(l => {
            // Check for potential matches
            const venueMatch = ['tokyo', 'fukuoka', 'both', '東京', '福岡', '両方参加'].includes(l.venue_lecture);
            const socialMatch = ['tokyo', 'fukuoka', 'both', '東京', '福岡', '両方参加'].includes(l.venue_social);
            return venueMatch || socialMatch;
        });

        console.log('Relevant Payment Links:');
        relevant.forEach(l => {
            console.log(`- [RankID: ${l.rank_id}] Venue: ${l.venue_lecture}, Social: ${l.venue_social}, Name: ${l.name}`);
        });

        // Check specifically for Rank + Tokyo + Fukuoka
        if (rank) {
            const targetRankId = String(rank.id);
            console.log(`\nChecking for Rank ID: ${targetRankId}`);

            // Possibilities for venue/social
            // User input: venue=tokyo/fukuoka (both?), social=fukuoka/tokyo (both?)
            // venueDisplayMap says 'both' -> '両方参加'

            const exactMatches = links.filter(l => String(l.rank_id) === targetRankId);
            console.log('Links for this Rank:');
            exactMatches.forEach(l => {
                console.log(`  > Venue: ${l.venue_lecture}, Social: ${l.venue_social}`);
            });
        }
    }
}

run();
