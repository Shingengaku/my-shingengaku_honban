
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function main() {
    console.log('Inspecting applications table...');
    const { data: apps, error: appError } = await supabaseAdmin
        .from('applications')
        .select('*')
        .limit(1);

    if (appError) {
        console.error('Error fetching applications:', appError);
    } else {
        if (apps && apps.length > 0) {
            console.log('Applications Table Keys:', Object.keys(apps[0]));
        } else {
            console.log('Applications table is empty.');
        }
    }

    console.log('Inspecting members table...');
    const { data: members, error: memberError } = await supabaseAdmin
        .from('members')
        .select('*')
        .limit(1);

    if (memberError) {
        console.error('Error fetching members:', memberError);
    } else {
        if (members && members.length > 0) {
            console.log('Members Table Keys:', Object.keys(members[0]));
        } else {
            console.log('Members table is empty.');
        }
    }
}

main().catch(console.error);
