import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function dump() {
    const { data } = await supabaseAdmin.from('app_settings').select('*').eq('key', 'payment_links').single();
    if (data) {
        fs.writeFileSync('payment_links_dump.json', JSON.stringify(data.value, null, 2));
    }
}
dump().catch(console.error);
