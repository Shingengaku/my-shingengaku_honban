
const { createClient } = require('@supabase/supabase-js');

const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";
const TEST_URL = "https://denudyfitlmigrbxszad.supabase.co";
const TEST_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

const prodClient = createClient(PROD_URL, PROD_KEY);
const testClient = createClient(TEST_URL, TEST_KEY);

const tables = ['applications', 'members', 'terms', 'app_settings', 'venues', 'ranks', 'online_options'];

async function compareSchemas() {
    console.log("Comparing Prod and Test Schemas...");
    for (const table of tables) {
        console.log(`\n--- Table: ${table} ---`);
        
        // Prod Column Fetch
        const { data: prodData, error: prodErr } = await prodClient.from(table).select('*').limit(1);
        if (prodErr) {
            console.log(`PROD: ${prodErr.message}`);
        }
        
        // Test Column Fetch
        const { data: testData, error: testErr } = await testClient.from(table).select('*').limit(1);
        if (testErr) {
            console.log(`TEST: ${testErr.message}`);
        }

        if (!prodErr && !testErr) {
            const prodCols = prodData.length > 0 ? Object.keys(prodData[0]) : [];
            const testCols = testData.length > 0 ? Object.keys(testData[0]) : [];
            
            const missingInTest = prodCols.filter(c => !testCols.includes(c));
            const extraInTest = testCols.filter(c => !prodCols.includes(c));
            
            if (missingInTest.length > 0) console.log(`[MISSING in TEST]: ${missingInTest.join(', ')}`);
            if (extraInTest.length > 0) console.log(`[EXTRA in TEST]: ${extraInTest.join(', ')}`);
            if (missingInTest.length === 0 && extraInTest.length === 0) console.log("[OK] Column names match.");
        } else if (!prodErr && testErr && testErr.code === '42P01') {
            console.log(`[MISSING Table in TEST]`);
        }
    }
}

compareSchemas();
