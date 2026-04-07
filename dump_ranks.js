const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpRanks() {
  const { data, error } = await supabase
    .from("ranks")
    .select("*")
    .order("id");

  if (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

dumpRanks();
