
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const VENUE_TRANSLATION_MAP = {
    'tokyo': '東京',
    'fukuoka': '福岡',
    'both': '東京・福岡',
    'none': '参加しない',
    '両方参加': '東京・福岡',
    '参加しません': '参加しない'
};

async function migrateData() {
    console.log('--- Phase 1: Applications Normalization ---');
    const { data: apps, error: fetchError } = await supabase.from('applications').select('id, venue, social_venue, online_venues, participation_type, remarks');
    
    if (fetchError) { console.error('Error fetching applications:', fetchError); return; }

    for (const app of apps) {
        let updated = false;
        const newVenue = VENUE_TRANSLATION_MAP[app.venue] || (app.venue === 'LIVE視聴（2会場）' ? 'LIVE視聴' : app.venue);
        const newSocial = VENUE_TRANSLATION_MAP[app.social_venue] || app.social_venue;
        let newOnlineVenues = app.online_venues;

        // 特殊ケース：LIVE視聴（2会場）の救済
        if (app.venue === 'LIVE視聴（2会場）' && !newOnlineVenues) {
            newOnlineVenues = '東京・福岡';
            updated = true;
        }

        if (newVenue !== app.venue || newSocial !== app.social_venue || newOnlineVenues !== app.online_venues) {
            const { error: updateError } = await supabase.from('applications').update({
                venue: newVenue,
                social_venue: newSocial,
                online_venues: newOnlineVenues
            }).eq('id', app.id);
            if (updateError) console.error(`Error updating app ${app.id}:`, updateError);
            else updated = true;
        }
        if (updated) console.log(`Updated app ${app.id}: ${app.venue} -> ${newVenue}`);
    }

    console.log('\n--- Phase 2: app_settings (payment_links) Normalization ---');
    const { data: settings, error: settingsError } = await supabase.from('app_settings').select('*').eq('key', 'payment_links').single();
    
    if (!settingsError && settings.value) {
        let changed = false;
        const newValue = settings.value.map(p => {
            const nv = VENUE_TRANSLATION_MAP[p.venue_lecture] || (p.venue_lecture === 'LIVE視聴（2会場）' ? 'LIVE視聴' : p.venue_lecture);
            const ns = VENUE_TRANSLATION_MAP[p.venue_social] || p.venue_social;
            if (nv !== p.venue_lecture || ns !== p.venue_social) {
                changed = true;
                return { ...p, venue_lecture: nv, venue_social: ns };
            }
            return p;
        });

        if (changed) {
            const { error: saveError } = await supabase.from('app_settings').update({ value: newValue }).eq('key', 'payment_links');
            if (saveError) console.error('Error saving settings:', saveError);
            else console.log('Successfully updated payment_links master data.');
        } else {
            console.log('No changes needed for payment_links.');
        }
    }

    console.log('\n--- Phase 3: online_options Normalization ---');
    const { error: optError } = await supabase.from('online_options').delete().eq('name', 'LIVE視聴（2会場）');
    if (optError) console.error('Error deleting old online option:', optError);
    else console.log('Deleted legacy "LIVE視聴（2会場）" from online_options.');
    
    console.log('\nMigration complete.');
}

migrateData();
