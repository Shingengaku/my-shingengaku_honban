
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'admin_users' });
    // Note: get_table_info might not exist. Let's try a simple query and check the keys of the first row.
    const { data: users } = await supabase.from('admin_users').select('*').limit(1);
    if (users && users.length > 0) {
        console.log('Columns in admin_users:', Object.keys(users[0]));
    } else {
        console.log('No users found to check columns.');
    }
}

checkSchema();
