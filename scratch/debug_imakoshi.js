
const fs = require('fs');
const path = require('path');
const https = require('https');

async function main() {
    const envPath = path.resolve('.env.local');
    const env = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    });

    const url = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/applications`);
    url.searchParams.set('input_name', 'ilike.%今越%');

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
            apps.forEach(a => {
                console.log(`ID: ${a.id}`);
                console.log(`  Name: "${a.input_name}" Hex: ${Buffer.from(a.input_name).toString('hex')}`);
                console.log(`  Email: "${a.input_email}" Hex: ${Buffer.from(a.input_email).toString('hex')}`);
                console.log(`  Venue: "${a.venue}"`);
                console.log(`  OnlineVenues: "${a.online_venues}"`);
                console.log(`  PType: "${a.participation_type}"`);
            });
        });
    });
}
main();
