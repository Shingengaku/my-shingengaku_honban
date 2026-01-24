
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Production (Target)
const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

// Test (Source) - Local .env.local
const TEST_URL = "https://denudyfitlmigrbxszad.supabase.co";
const TEST_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

const prodClient = createClient(PROD_URL, PROD_KEY);
const testClient = createClient(TEST_URL, TEST_KEY);

async function checkAndApply() {
    console.log("Checking schemas...");

    // 1. Check if online_options exists in Prod
    const { error: err1 } = await prodClient.from('online_options').select('count', { count: 'exact', head: true });
    if (err1 && err1.code === '42P01') {
        console.log("[MISSING] online_options table missing in Prod.");
    } else {
        console.log("[OK] online_options table exists in Prod.");
    }

    // 2. Check columns in applications
    console.log("Checking applications table columns...");
    // We can't easily list columns via API, but we can try to select them and see if it errors
    const { error: err2 } = await prodClient.from('applications').select('participation_type, attend_social, social_venue').limit(1);
    if (err2) {
        console.log("[MISSING] Some columns in applications are missing:", err2.message);
    } else {
        console.log("[OK] participation_type, attend_social, social_venue columns exist.");
    }

    // 3. Check App Settings structure (JSONB usually, so hard to check schema structure, but check if keys exist?)
    // app_settings is Key-Value, so we check if keys exist
    const { data: settings } = await prodClient.from('app_settings').select('key');
    const keys = settings ? settings.map(s => s.key) : [];
    console.log("Prod App Settings Keys:", keys);

    const expectedKeys = ['email_template', 'email_template_general', 'payment_links', 'product_name_master'];
    const missingKeys = expectedKeys.filter(k => !keys.includes(k));
    if (missingKeys.length > 0) {
        console.log("[WARN] Missing setting keys in Prod:", missingKeys);
    } else {
        console.log("[OK] Essential app_settings keys exist.");
    }

}

checkAndApply();
