
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
    url.searchParams.set('select', 'input_name,input_email,venue,online_venues,participation_type,payment_status');

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
            const map = new Map();
            apps.forEach(app => {
                if ((app.payment_status || '').toLowerCase() === 'cancelled') return;
                const name = (app.input_name || '').replace(/\s+/g, '');
                const email = (app.input_email || '').toLowerCase().trim();
                const key = `${name}|${email}`;
                if (!key || key === '|') return;

                if (!map.has(key)) map.set(key, { venueArea: new Set(), onlineArea: new Set(), raw: [] });
                const status = getParticipationStatus(app);
                const entry = map.get(key);
                entry.raw.push(app);
                
                if (status.venueArea === 'both') { entry.venueArea.add('tokyo'); entry.venueArea.add('fukuoka'); }
                else if (status.venueArea) entry.venueArea.add(status.venueArea);

                if (status.onlineArea === 'both') { entry.onlineArea.add('tokyo'); entry.onlineArea.add('fukuoka'); }
                else if (status.onlineArea) entry.onlineArea.add(status.onlineArea);
            });

            console.log("--- Hybrid Candidates ---");
            map.forEach((areas, key) => {
                const isBoth = areas.venueArea.has('tokyo') && areas.venueArea.has('fukuoka');
                const isHybrid = !isBoth && areas.venueArea.size > 0 && areas.onlineArea.size > 0;
                
                if (isHybrid) {
                    console.log(`[Hybrid] ${key}`);
                    areas.raw.forEach(r => console.log(`  - ${r.venue} / ${r.online_venues} (${r.participation_type})`));
                }
            });
        });
    });
}
main();
