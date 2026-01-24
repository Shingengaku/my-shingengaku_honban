
const { createClient } = require('@supabase/supabase-js');

// Prod credentials from env_backup_production.txt
const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

const supabase = createClient(PROD_URL, PROD_KEY);

async function checkOnlineProd() {
    console.log("Checking PROD online_options...");
    const { data, error } = await supabase.from('online_options').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkOnlineProd();
