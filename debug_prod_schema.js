
const { createClient } = require('@supabase/supabase-js');

const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

const supabase = createClient(PROD_URL, PROD_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function inspectMembers() {
    console.log("Inspecting members table in PROD...");
    const { data, error } = await supabase
        .from('members')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    if (data.length > 0) {
        console.log("Member columns:", Object.keys(data[0]));
        console.log("Sample member:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No members found, cannot inspect columns easily via select *");
    }
}

inspectMembers();
