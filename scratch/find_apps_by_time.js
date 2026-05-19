const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .gte('created_at', '2026-05-14T07:10:00Z')
    .lte('created_at', '2026-05-14T07:15:00Z');

  if (error) {
    console.error(error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

findApplications();
