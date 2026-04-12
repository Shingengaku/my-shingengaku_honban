
const fs = require('fs');
const path = require('path');
const https = require('https');

async function main() {
    const envPath = path.resolve('.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        return;
    }
    const env = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    });

    const url = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set('input_name', 'ilike.%今越%');
    url.searchParams.set('select', 'id,input_name,venue,online_venues,participation_type,payment_status,payment_key');

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
            try {
                const json = JSON.parse(data);
                console.log(JSON.stringify(json, null, 2));
            } catch (e) {
                console.error('Parse error:', e);
                console.log('Raw data:', data);
            }
        });
    }).on('error', (err) => {
        console.error('HTTPS error:', err);
    });
}

main();
