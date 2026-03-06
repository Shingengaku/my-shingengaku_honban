const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase.from('app_settings')
        .select('key, value')
        .in('key', ['email_template_free', 'email_template_free_online']);

    if (error) {
        console.error('Error:', error);
    } else {
        data.forEach(row => {
            console.log(`--- ${row.key} ---`);
            console.log(row.value.subject);
            console.log(row.value.body);
        });
    }
}
run();
