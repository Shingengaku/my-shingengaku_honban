require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateOnlineVenues() {
    console.log('Fetching existing online applications...');
    
    // First, list all applications where participation_type = 'online'
    const { data: apps, error } = await supabase
        .from('applications')
        .select('id, remarks, participation_type')
        .eq('participation_type', 'online');

    if (error) {
        console.error('Error fetching applications:', error);
        return;
    }

    console.log(`Found ${apps.length} online applications.`);

    let updatedCount = 0;

    for (const app of apps) {
        let onlineVenues = null;
        let newRemarks = app.remarks;

        // "【LIVE視聴会場】東京・福岡" 等を抽出
        if (app.remarks) {
            const match = /【LIVE視聴会場】\s*([^\n]+)/.exec(app.remarks);
            if (match) {
                onlineVenues = match[1].trim();
                // 備考からこの行を削除する
                newRemarks = app.remarks.replace(/【LIVE視聴会場】\s*[^\n]+/, '').trim();
                if (newRemarks === '') newRemarks = null;
            }
        }

        // onlineVenuesがnullでも、とりあえずカラムを初期化できるのでupdateする
        console.log(`App ID: ${app.id}, Online Venues: ${onlineVenues}`);
        
        const { error: updateError } = await supabase
            .from('applications')
            .update({ 
                online_venues: onlineVenues,
                remarks: newRemarks
            })
            .eq('id', app.id);

        if (updateError) {
            console.error('Update failed for ID', app.id, updateError);
        } else {
            updatedCount++;
        }
    }

    console.log(`Migration complete! Successfully updated ${updatedCount} records.`);
}

migrateOnlineVenues();
