import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
    const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_links');

    if (!settings || settings.length === 0) {
        console.log('No payment links found in DB');
        return;
    }
    const paymentLinks = settings[0].value;

    console.log('--- ALL PAYMENT LINKS WITH LIVE ---');
    paymentLinks.forEach((p: any) => {
        if (p.venue_lecture && p.venue_lecture.includes('LIVE')) {
            console.log(`- Name: ${p.name}, Venue: "${p.venue_lecture}", Social: "${p.venue_social}", Rank: ${p.rank_id}`);
        }
    });

    const { data: apps } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    console.log('\n--- RECENT LIVE APPLICATIONS ---');
    apps?.forEach((a: any) => {
        if (a.venue && a.venue.includes('LIVE')) {
            console.log(`- ID: ${a.id}, Name: ${a.input_name}, Venue: "${a.venue}", Social: "${a.social_venue}", Type: "${a.participation_type}", Rank: "${a.applied_rank_name}", payment_key: "${a.payment_key || ''}"`);
            console.log(`  Remarks: ${a.remarks ? a.remarks.replace(/\n/g, '\\n') : 'none'}`);
        }
    });
}
check();
