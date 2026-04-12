
const fs = require('fs');
const path = require('path');
const https = require('https');

async function main() {
    const envPath = path.resolve('.env.local');
    if (!fs.existsSync(envPath)) return;
    const env = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    });

    const url = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set('input_name', 'ilike.%今越%');
    url.searchParams.set('select', 'id,input_name,input_email,venue,online_venues,participation_type,payment_status');

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
            console.log(data);
        });
    });
}
main();
