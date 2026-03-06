
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
    const envConfig = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
        }
    });
} catch (e) {
    console.error('Error loading .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGogoApps() {
    console.log('Fetching applications...');
    const { data: apps, error } = await supabase
        .from('applications')
        .select('*');

    if (error) {
        console.error('Error fetching apps:', error);
        return;
    }

    console.log(`Total apps: ${apps.length}`);

    // Filter for potential GoGo/Referral apps
    const keywords = ['GoGo', '紹介', '55000'];
    const candidates = apps.filter(app => {
        const jsonStr = JSON.stringify(app);
        return keywords.some(k => jsonStr.includes(k));
    });

    console.log(`Found ${candidates.length} candidates.`);

    candidates.forEach(app => {
        console.log('--------------------------------------------------');
        console.log(`ID: ${app.id}`);
        console.log(`Name: ${app.input_name}`);
        console.log(`Venue: ${app.venue}`);
        console.log(`Social: ${app.social_venue}`);
        console.log(`Payment Key: ${app.payment_key}`);
        console.log(`Remarks: ${app.remarks}`);
        console.log(`Introducer:`, app.introducer || 'N/A');
    });
}

checkGogoApps();
