
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrateRankIds() {
    console.log('--- Starting Rank ID Migration for Payment Links ---');
    
    // 1. Get current settings
    const { data: settingsRes, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_links')
        .single();
        
    if (fetchError || !settingsRes) {
        console.error('Failed to fetch payment_links');
        return;
    }
    
    let paymentLinks = settingsRes.value;
    let updatedCount = 0;

    // Mapping Rules based on previous research
    // ID 2: リピート
    // ID 7: 神言学未受講（一般）
    // ID 8: 神言学未受講（ご紹介） 
    // ID 9: 社員・関連会社 (社割, 社員)
    // ID 4: 経営幹部コース

    paymentLinks = paymentLinks.map(p => {
        if (!p.rank_id) {
            let newId = null;
            if (p.name.includes('リピート')) newId = 2;
            else if (p.name.includes('ご紹介')) newId = 8;
            else if (p.name.includes('一般')) newId = 7;
            else if (p.name.includes('社割') || p.name.includes('社員')) newId = 9;
            else if (p.name.includes('経営幹部') || p.name.includes('集中講座')) newId = 4;
            
            if (newId) {
                console.log(`Updating [${p.name}] -> Rank ID: ${newId}`);
                updatedCount++;
                return { ...p, rank_id: newId };
            }
        }
        return p;
    });

    if (updatedCount > 0) {
        const { error: updateError } = await supabase
            .from('app_settings')
            .update({ value: paymentLinks })
            .eq('key', 'payment_links');
            
        if (updateError) {
            console.error('Update failed:', updateError);
        } else {
            console.log(`Successfully updated ${updatedCount} products with Rank IDs.`);
        }
    } else {
        console.log('No products needed updating.');
    }
}

migrateRankIds();
