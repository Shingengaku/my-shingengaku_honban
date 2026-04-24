
const { createClient } = require('@supabase/supabase-js');

const TEST_URL = "https://denudyfitlmigrbxszad.supabase.co";
const TEST_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

const testClient = createClient(TEST_URL, TEST_KEY);

const tables = ['applications', 'app_settings', 'admin_users', 'members', 'venues', 'ranks', 'terms', 'online_options'];

async function checkTables() {
    console.log("Checking tables in Test DB...");
    for (const table of tables) {
        const { error } = await testClient.from(table).select('*').limit(1);
        if (error) {
            console.log(`[ABSENT] ${table}: ${error.code} - ${error.message}`);
        } else {
            console.log(`[PRESENT] ${table}`);
        }
    }
}

checkTables();
