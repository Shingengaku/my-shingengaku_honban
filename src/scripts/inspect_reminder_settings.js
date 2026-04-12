
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectReminderSettings() {
    const keys = [
        'email_template_reminder_venue_paid',
        'email_template_reminder_venue_unpaid',
        'email_template_reminder_online_paid',
        'email_template_reminder_online_unpaid',
        'lecture_dates',
        'online_viewing_links'
    ];
    const { data, error } = await supabase.from('app_settings').select('*').in('key', keys);
    if (error) {
        console.error(error);
        return;
    }
    console.log('Reminder Settings in DB:');
    data.forEach(d => {
        console.log(`- ${d.key}: (${typeof d.value}) ${JSON.stringify(d.value)}`);
    });
}

inspectReminderSettings();
