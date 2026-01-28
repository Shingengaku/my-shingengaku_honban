
const { createClient } = require('@supabase/supabase-js');

// Prod credentials from check_online_prod.js
const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

const supabase = createClient(PROD_URL, PROD_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function testFetch() {
    console.log("Testing fetch from PROD:", PROD_URL);
    const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          members (
            terms ( name ),
            generation,
            furigana,
            ranks (
              name,
              base_fee,
              sort_order
            )
          )
        `);

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    console.log(`Fetched ${data.length} records.`);

    // Find a record with members
    const withMembers = data.find(d => d.members);
    if (withMembers) {
        console.log("Record with members found:", JSON.stringify(withMembers, null, 2));
    } else {
        console.log("No records with members found.");
    }

    // Simulate Sorting Logic
    try {
        console.log("Testing sorting logic...");
        const sortedData = data.sort((a, b) => {
            // 1. Created At
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            if (dateA !== dateB) return dateB - dateA;

            // 2. Rank
            const rankOrderA = a.members?.ranks?.sort_order ?? 999;
            const rankOrderB = b.members?.ranks?.sort_order ?? 999;
            if (rankOrderA !== rankOrderB) return rankOrderA - rankOrderB;

            // 3. Term / Generation
            const genA = parseInt(a.members?.terms?.name || a.members?.generation || '9999');
            const genB = parseInt(b.members?.terms?.name || b.members?.generation || '9999');
            if (genA !== genB) return genA - genB;

            // 4. Furigana
            const furiganaA = a.members?.furigana || a.input_furigana || '';
            const furiganaB = b.members?.furigana || b.input_furigana || '';
            return furiganaA.localeCompare(furiganaB, 'ja');
        });
        console.log("Sorting successful!");
    } catch (e) {
        console.error("Sorting FAILED:", e);
    }
}

testFetch();
