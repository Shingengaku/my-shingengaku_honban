
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkUsersHex() {
    const { data, error } = await supabase
        .from('admin_users')
        .select('*');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('--- Admin Users (Hex Debug) ---');
    data?.forEach(user => {
        const usernameHex = Buffer.from(user.username).toString('hex');
        console.log(`User: ${user.username}`);
        console.log(`  Username Hex: ${usernameHex}`);
        console.log(`  Password Hash: ${user.password_hash}`);
        console.log(`  Created At: ${user.created_at}`);
    });
}

checkUsersHex();
