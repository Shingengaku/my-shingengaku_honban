
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking Online Options ---');
    const { data: onlineOptions, error: onlineError } = await supabase
        .from('online_options')
        .select('*');

    if (onlineError) {
        console.error('Error fetching online_options:', onlineError);
    } else {
        console.table(onlineOptions);
    }

    console.log('\n--- Checking Product Master (Payment Links) ---');
    const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*');

    if (settingsError) {
        console.error('Error fetching app_settings:', settingsError);
    } else {
        // Look for payment_links in the data
        // settingsData structure depends on how it's stored. Usually it's rows of key/value or a big json.
        // Based on manual, 'app_settings' has 'id' and 'data' jsonb. 
        // Wait, MANUAL says: create table app_settings (id integer primary key, data jsonb);
        // But API code says: .from('app_settings').select('*'); then iterates rows assuming row.key?
        // Let's re-read API code.
        // src/app/api/apply/route.ts: 
        // const { data: settingsData } = ...
        // settingsData?.forEach(row => { if (row.key === 'payment_links') ... })
        //
        // This implies schema is Key-Value rows?
        // BUT MANUAL says: `insert into app_settings (id, data) values (1, '{}')` 
        // AND src/app/api/apply/route.ts lines 135: `settingsData?.forEach(row => { if (row.key === ...)`
        //
        // Wait, let's look at `src/app/api/apply/route.ts` carefully again.
        // Line 121: .from('app_settings').select('*')
        // Line 135: row.key === ...
        //
        // AND `src/app/admin/products/page.tsx` line 343: `const settings = data;` (direct object?)
        // `src/app/api/admin/settings/route.ts` (IMPLIED) probably handles the difference.
        //
        // Let's dump whatever is in 'app_settings'.
        try {
            if (settingsData && settingsData.length > 0) {
                console.log('Found rows:', settingsData.length);
                settingsData.forEach(row => {
                    if (row.key) {
                        console.log(`[Row Key: ${row.key}]`);
                        if (row.key === 'payment_links') {
                            console.log(JSON.stringify(row.value, null, 2));
                        }
                    } else if (row.data) {
                        console.log('[Row with data column]');
                        console.log(JSON.stringify(row.data, null, 2));
                    } else {
                        console.log('Row structure unkonwn:', row);
                    }
                });
            } else {
                console.log('No data in app_settings');
            }
        } catch (e) {
            console.error(e);
        }
    }
}

checkData();
