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
    .select('id, remarks, tags')
    .eq('id', 'f3bcbf62-677a-4caa-b7f8-e7731c71d2c6')
    .single();
    
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  
  let newTags = data.tags || [];
  if (!newTags.includes('ご紹介')) {
    newTags.push('ご紹介');
  }
  
  const { error: updateError } = await supabase
    .from('applications')
    .update({
      introducer: '冨田顕子',
      remarks: data.remarks.replace('ご紹介者さま：冨田顕子', '').trim(),
      applied_rank_name: '神言学未受講（ご紹介）',
      tags: newTags
    })
    .eq('id', 'f3bcbf62-677a-4caa-b7f8-e7731c71d2c6');
    
  if (updateError) {
    console.error("Error updating record:", updateError);
  } else {
    console.log("Successfully fixed record f3bcbf62-677a-4caa-b7f8-e7731c71d2c6");
  }
}

main();
