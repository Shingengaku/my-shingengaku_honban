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
    .select('id, remarks, tags, applied_rank_name')
    .ilike('remarks', '%紹介%')
    .is('introducer', null);
    
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  
  if (data.length === 0) {
    console.log("No records found to fix.");
    return;
  }
  
  for (const record of data) {
    console.log(`Fixing record ${record.id} with remarks: ${record.remarks}`);
    
    let newTags = record.tags || [];
    if (!newTags.includes('ご紹介')) {
      newTags.push('ご紹介');
    }
    
    // Extract introducer
    let extractedIntroducer = '不明';
    let newRemarks = record.remarks || '';
    
    // Pattern 1: 紹介者：XXX
    const match1 = record.remarks.match(/紹介者[:：]\s*([^\r\n]+)/);
    // Pattern 2: ご紹介者さま：XXX
    const match2 = record.remarks.match(/ご紹介者さま[:：]\s*([^\r\n]+)/);
    
    if (match1) {
      extractedIntroducer = match1[1].trim();
      newRemarks = record.remarks.replace(match1[0], '').trim();
    } else if (match2) {
      extractedIntroducer = match2[1].trim();
      newRemarks = record.remarks.replace(match2[0], '').trim();
    } else {
      console.log(`Could not extract introducer from: ${record.remarks}`);
      // Fallback extraction
      const parts = record.remarks.split(/[:：]/);
      if (parts.length > 1) {
          extractedIntroducer = parts[1].trim().split(/[\r\n]/)[0];
          newRemarks = record.remarks.replace(parts[0] + parts[1].charAt(0) + extractedIntroducer, '').trim();
      }
    }
    
    console.log(`Extracted: ${extractedIntroducer}`);
    
    let newRankName = record.applied_rank_name;
    if (newRankName === '神言学未受講（一般）' || !newRankName) {
        newRankName = '神言学未受講（ご紹介）';
    }
    
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        introducer: extractedIntroducer,
        remarks: newRemarks || null,
        applied_rank_name: newRankName,
        tags: newTags
      })
      .eq('id', record.id);
      
    if (updateError) {
      console.error(`Error updating record ${record.id}:`, updateError);
    } else {
      console.log(`Successfully fixed record ${record.id}`);
    }
  }
}

main();
