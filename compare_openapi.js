const https = require('https');

const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";
const TEST_URL = "https://denudyfitlmigrbxszad.supabase.co";
const TEST_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

function fetchSpec(url, key) {
    return new Promise((resolve, reject) => {
        const req = https.request(`${url}/rest/v1/`, {
            headers: { 'apikey': key }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    const prodSpec = await fetchSpec(PROD_URL, PROD_KEY);
    const testSpec = await fetchSpec(TEST_URL, TEST_KEY);

    const prodTables = Object.keys(prodSpec.definitions).filter(k => !k.includes(' '));
    const testTables = Object.keys(testSpec.definitions).filter(k => !k.includes(' '));

    console.log("=== MISSING TABLES IN DEV ===");
    const missingTables = prodTables.filter(t => !testTables.includes(t));
    missingTables.forEach(t => {
        console.log(`Table: ${t}`);
        console.log(prodSpec.definitions[t]);
    });

    console.log("\n=== COLUMN DIFFERENCES ===");
    for (const t of prodTables) {
        if (!testTables.includes(t)) continue;
        
        const prodProps = prodSpec.definitions[t].properties || {};
        const testProps = testSpec.definitions[t].properties || {};
        
        const missingCols = Object.keys(prodProps).filter(c => !testProps[c]);
        const extraCols = Object.keys(testProps).filter(c => !prodProps[c]);
        
        if (missingCols.length > 0) {
            console.log(`[${t}] Missing in Dev:`, missingCols.map(c => `${c} (${prodProps[c].type}/${prodProps[c].format})`).join(', '));
        }
        if (extraCols.length > 0) {
            console.log(`[${t}] Extra in Dev:`, extraCols.join(', '));
        }
    }
}

run().catch(console.error);
