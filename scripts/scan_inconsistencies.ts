import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scanInconsistencies() {
  console.log('--- 申込データの不整合スキャン開始 ---');

  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, input_name, venue, social_venue, applied_rank_name, participation_type, created_at, remarks')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching applications:', error);
    return;
  }

  console.log(`全申込データ: ${apps.length} 件`);

  // 不整合パターン1: participation_type と venue の不整合
  const issueTypeAndVenue = apps.filter(app => {
    // 参加タイプが venue なのに、venue がオンラインの選択肢（LIVE視聴など）になっている
    if (app.participation_type === 'venue' && (app.venue?.includes('LIVE') || app.venue?.includes('アーカイブ'))) {
        return true;
    }
    // 参加タイプが online なのに、venue が現地の選択肢（東京、福岡など）になっている
    // ※ 過去の仕様で venue に直接「東京」などを入れていた場合は除外ルールが必要かもしれないが、現在の仕様では問題
    if (app.participation_type === 'online' && !app.venue?.includes('LIVE') && !app.venue?.includes('アーカイブ') && app.venue !== 'none') {
        return true;
    }
    return false;
  });

  // 不整合パターン2: 商品（applied_rank_name等）からの推定と participation_type のズレ
  // dashboardから、「会場参加」なのに「LIVE視聴の商品」がマッチしている、という問題があった
  // 今回のDBスキーマだと matchedProduct の情報は主に総額(total_amount)や applied_rank_name として残るため
  // 正確には remarks に「【LIVE視聴会場】」があるか等も判断材料になる
  const issueProductMismatch = apps.filter(app => {
      // 備考(remarks)にLIVE視聴会場があるのに、participation_typeがvenue
      if (app.remarks?.includes('【LIVE視聴会場】') && app.participation_type === 'venue') {
          return true;
      }
      return false;
  });
  
  // 不整合パターン3: 懇親会(social_venue)の不整合
  // オンライン参加なのに social_venue が none/参加しない 以外になっている
  const issueOnlineSocial = apps.filter(app => {
      if (app.participation_type === 'online' && app.social_venue && app.social_venue !== 'none' && app.social_venue !== '参加しません' && app.social_venue !== '参加しない' && app.social_venue !== 'ー') {
          return true;
      }
      return false;
  });

  console.log(`\n【不整合1】参加タイプと会場文字列の不一致: ${issueTypeAndVenue.length} 件`);
  issueTypeAndVenue.slice(0, 5).forEach(app => console.log(`  - ID: ${app.id}, Name: ${app.input_name}, Type: ${app.participation_type}, Venue: ${app.venue}`));

  console.log(`\n【不整合2】備考(LIVE等)と参加タイプの不一致: ${issueProductMismatch.length} 件`);
  issueProductMismatch.slice(0, 5).forEach(app => console.log(`  - ID: ${app.id}, Name: ${app.input_name}, Type: ${app.participation_type}, Remarks: ${app.remarks?.replace(/\n/g, ' ')}`));

  console.log(`\n【不整合3】オンライン参加で懇親会が設定されている: ${issueOnlineSocial.length} 件`);
  issueOnlineSocial.slice(0, 5).forEach(app => console.log(`  - ID: ${app.id}, Name: ${app.input_name}, Type: ${app.participation_type}, Social: ${app.social_venue}`));
  
  
  // 原因の推測：DBカラム `participation_type` を追加する前の古いデータは `venue` か null になっている可能性がある。
  const missingType = apps.filter(app => !app.participation_type);
  console.log(`\n【参考】participation_type が未設定(null/empty)のデータ: ${missingType.length} 件`);

}

scanInconsistencies();
