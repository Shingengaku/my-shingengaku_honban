
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSettings() {
    const { data, error } = await supabase.from('app_settings').select('key');
    if (error) {
        console.error(error);
        return;
    }
    console.log('App Setting Keys:');
    data.forEach(d => console.log(`- ${d.key}`));
}

checkSettings();
