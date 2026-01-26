
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually load env vars
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^"(.*)"$/, '$1'); // Remove quotes if present
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. Make sure .env.local exists or vars are set.');
    console.error('URL:', supabaseUrl ? 'Set' : 'Missing');
    console.error('Key:', supabaseServiceKey ? 'Set' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySettingsPersistence() {
    console.log('Starting verification of email_template_free persistence (JS)...');

    const testTemplate = {
        subject: 'Verification Test 0 Yen (JS)',
        body: 'This is a test body for 0 yen template verification (JS).'
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
}

verifySettingsPersistence();
