
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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
        console.log(`Payment Key: ${app.payment_key}`);
        console.log(`Remarks: ${app.remarks}`);
        console.log(`Introducer (if any field exists):`, app.introducer || 'N/A');
    });
}

checkGogoApps();
