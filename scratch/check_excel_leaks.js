
const fs = require('fs');
const path = require('path');
const https = require('https');

const onlineKeywords = ['オンライン', 'LIVE', 'ライブ', '視聴', 'アーカイブ', '配信'];

const getParticipationStatus = (app) => {
    const venueName = (app.venue || '').trim();
    const onlineVenueInput = (app.online_venues || '').trim();
    const pType = (app.participation_type || '').toLowerCase().trim();

    const hasOnlineKeyword = onlineKeywords.some(k => venueName.toUpperCase().includes(k.toUpperCase()));
    const isExplicitOnline = pType === 'online' || hasOnlineKeyword;

    let venueArea = null;
    let onlineArea = null;

    if (isExplicitOnline || onlineVenueInput) {
        const v = (onlineVenueInput || venueName).toUpperCase();
        if (v.includes('東京') && v.includes('福岡')) onlineArea = 'both';
        else if (v.includes('福岡')) onlineArea = 'fukuoka';
        else if (v.includes('東京')) onlineArea = 'tokyo';
        else onlineArea = 'tokyo'; 
    }

    if (!isExplicitOnline) {
        const v = venueName.toUpperCase();
        if (v.includes('東京') && v.includes('福岡')) {
            venueArea = 'both';
        } else if (v.includes('福岡')) {
            venueArea = 'fukuoka';
        } else if (v.includes('東京')) {
            venueArea = 'tokyo';
        }
    }

    return { venueArea, onlineArea };
};

async function main() {
    const envPath = path.resolve('.env.local');
    const env = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    });

    const url = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set('select', 'input_name,venue,online_venues,participation_type,payment_status');

    const options = {
        headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    };

    https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            const apps = JSON.parse(data);
            const leaked = apps.filter(a => {
                if (a.payment_status === 'cancelled') return false;
                const status = getParticipationStatus(a);
                // 東京でも福岡でもない（＝どのエクセルブロックにも入らない）
                return !status.venueArea && !status.onlineArea;
            });

            if (leaked.length === 0) {
                console.log("No data leak found. All valid records match Tokyo or Fukuoka.");
            } else {
                console.log(`Found ${leaked.length} potentially missing records:`);
                leaked.forEach(l => {
                    console.log(`- ${l.input_name}: Venue="${l.venue}", OnlineVenues="${l.online_venues}", Type="${l.participation_type}"`);
                });
            }
        });
    });
}
main();
