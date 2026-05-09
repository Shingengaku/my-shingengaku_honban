
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Error: Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function updateFreeApplications() {
    console.log('Searching for free applications (total_amount = 0) with status "unpaid"...');

    // 1. Fetch records to be updated (for logging/dry-run)
    const { data: targets, error: fetchError } = await supabase
        .from('applications')
        .select('id, input_name, total_amount, payment_status')
        .eq('total_amount', 0)
        .eq('payment_status', 'unpaid');

    if (fetchError) {
        console.error('Error fetching applications:', fetchError);
        return;
    }

    if (!targets || targets.length === 0) {
        console.log('No free unpaid applications found. Everything is up to date.');
        return;
    }

    console.log(`Found ${targets.length} applications to update.`);
    targets.forEach(t => {
        console.log(`- [${t.id}] ${t.input_name}: amount=${t.total_amount}, status=${t.payment_status}`);
    });

    // 2. Perform update
    const { data: updated, error: updateError } = await supabase
        .from('applications')
        .update({ payment_status: 'paid' })
        .eq('total_amount', 0)
        .eq('payment_status', 'unpaid')
        .select();

    if (updateError) {
        console.error('Error updating applications:', updateError);
        return;
    }

    console.log(`Successfully updated ${updated.length} applications to "paid" status.`);
}

updateFreeApplications().catch(err => {
    console.error('Unexpected error:', err);
});
