const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase.from('app_settings').select('*');
    if (error) {
        console.error(error);
        return;
    }
    const lecture_dates = data.find(r => r.key === 'lecture_dates');
    const lecture_end_dates = data.find(r => r.key === 'lecture_end_dates');
    console.log('lecture_dates:', lecture_dates?.value);
    console.log('lecture_end_dates:', lecture_end_dates?.value);
}

checkSettings();
