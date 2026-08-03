const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('ranks').select('*');
  console.log(JSON.stringify(data, null, 2));
}
main();
