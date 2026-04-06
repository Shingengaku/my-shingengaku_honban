require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data, error } = await supabase.from('applications').select('id, venue, payment_key').eq('venue', 'LIVE視聴（2会場）');
  console.log('Found old records:', data?.length);

  if (data && data.length > 0) {
      console.log('Updating...');
      const { error: updateError } = await supabase
        .from('applications')
        .update({ venue: 'LIVE視聴' })
        .eq('venue', 'LIVE視聴（2会場）');
      
      if (updateError) {
          console.error(updateError);
      } else {
          console.log('Update complete!');
      }
  }
}
fix();
