import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- 修正対象の検索 ---');
  // participation_typeが'venue'だが、venueに'視聴'が含まれるレコードを検索
  const { data: targets, error: searchError } = await supabase
    .from('applications')
    .select('id, input_name, venue, social_venue, participation_type, created_at')
    .eq('participation_type', 'venue')
    .like('venue', '%視聴%');

  if (searchError) {
    console.error('Search Error:', searchError);
    return;
  }

  console.log(`該当レコード数: ${targets.length}件`);
  console.log(JSON.stringify(targets, null, 2));

  if (targets.length === 0) {
    console.log('修正すべきレコードはありませんでした。');
    return;
  }

  if (targets.length > 1) {
    console.log('対象が想定の1件より多いため、安全のために処理を中断します。');
    return;
  }

  console.log('--- 修正の実行 ---');
  const targetId = targets[0].id;
  
  // 安全のため social_venue も 'ー' に設定しておく（オンライン仕様）
  const { data: updateData, error: updateError } = await supabase
    .from('applications')
    .update({ 
      participation_type: 'online',
      social_venue: 'ー'
    })
    .eq('id', targetId)
    .select('*');

  if (updateError) {
    console.error('Update Error:', updateError);
    return;
  }

  console.log('修正が完了しました。修正後のデータ:');
  console.log(JSON.stringify(updateData, null, 2));
}

main().catch(console.error);
