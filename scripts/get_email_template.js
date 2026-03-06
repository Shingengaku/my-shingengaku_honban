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

async function getEmailTemplate() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'email_template_free')
        .single();
    if (error) {
        console.error('Fetch error:', error);
    } else {
        console.log('Template subject:', data.value.subject);
        console.log('Template body:\n', data.value.body);
    }
}

getEmailTemplate();
