const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function mergeMembers() {
  const primaryId = 518;
  const duplicateId = 591;

  console.log(`Merging member ${duplicateId} into ${primaryId}...`);

  // 1. Check if both exist
  const { data: members, error: fetchError } = await supabase
    .from('members')
    .select('*')
    .in('id', [primaryId, duplicateId]);

  if (fetchError || !members || members.length < 2) {
    console.error('Error: Could not find both members', fetchError, members);
    return;
  }

  const primary = members.find(m => m.id === primaryId);
  const duplicate = members.find(m => m.id === duplicateId);

  console.log('Primary:', primary);
  console.log('Duplicate:', duplicate);

  // 2. Re-link applications
  const { data: apps, error: appError } = await supabase
    .from('applications')
    .update({ matched_member_id: primaryId })
    .eq('matched_member_id', duplicateId)
    .select();

  if (appError) {
    console.error('Error re-linking applications:', appError);
    return;
  }
  console.log(`Re-linked ${apps.length} applications.`);

  // 3. Delete duplicate member
  const { error: deleteError } = await supabase
    .from('members')
    .delete()
    .eq('id', duplicateId);

  if (deleteError) {
    console.error('Error deleting duplicate member:', deleteError);
    return;
  }
  console.log('Deleted duplicate member.');

  console.log('Merge complete!');
}

mergeMembers();
