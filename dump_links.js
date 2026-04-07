const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpLinks() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("key", "payment_links")
    .single();

  if (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data.value, null, 2));
}

dumpLinks();
