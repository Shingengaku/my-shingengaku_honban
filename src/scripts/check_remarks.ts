import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('applications')
    .select('id, remarks, introducer, applied_rank_name')
    .ilike('remarks', '%紹介%');
    
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  
  console.log(`Found ${data.length} records with '紹介' in remarks.`);
  
  for (const record of data) {
    console.log(`ID: ${record.id}`);
    console.log(`Rank: ${record.applied_rank_name}`);
    console.log(`Introducer: ${record.introducer}`);
    console.log(`Remarks: ${record.remarks}`);
    console.log("--------------------------------------------------");
  }
}

main();
