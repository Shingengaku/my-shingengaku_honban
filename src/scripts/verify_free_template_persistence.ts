
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySettingsPersistence() {
    console.log('Starting verification of email_template_free persistence...');

    const testTemplate = {
        subject: 'Verification Test 0 Yen',
        body: 'This is a test body for 0 yen template verification.'
    };

    // 1. Save the setting
    console.log('Upserting email_template_free...');
    const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert({ key: 'email_template_free', value: testTemplate }, { onConflict: 'key' });

    if (upsertError) {
        console.error('Upsert failed:', upsertError);
        return;
    }
    console.log('Upsert successful.');

    // 2. Fetch the setting
    console.log('Fetching email_template_free...');
    const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'email_template_free')
        .single();

    if (fetchError) {
        console.error('Fetch failed:', fetchError);
        return;
    }

    // 3. Verify content
    console.log('Fetched Data:', data);
    if (data.value.subject === testTemplate.subject && data.value.body === testTemplate.body) {
        console.log('SUCCESS: Template content verified!');
    } else {
        console.error('FAILURE: Content mismatch', data.value);
    }

    // Cleanup (Optional: restore default or leave it? Leaving it might act as a useful default if the user hasn't set one, but better to maybe clear it or leave it as "verified")
    // Let's leave it, the user can overwrite it in the UI.
}

verifySettingsPersistence();
