require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
async function check() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('applications').select('participation_type').limit(1);
  if (error) console.error("ERROR:", error.message);
  else console.log("SUCCESS:", data);
}
check();
