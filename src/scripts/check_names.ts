
import { supabaseAdmin } from '../lib/supabaseAdmin';

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
