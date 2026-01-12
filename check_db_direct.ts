
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local をロード
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log('Checking members names...');
    const { data: members, error } = await supabaseAdmin
        .from('members')
        .select('id, name, email')
        .limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Members:', JSON.stringify(members, null, 2));
    }
}

main().catch(console.error);
