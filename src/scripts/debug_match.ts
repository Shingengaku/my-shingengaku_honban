import { matchProduct, normalizeVenue } from './src/lib/venueUtils';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verify() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // 1. 商品マスタ取得
    const { data: settings } = await supabase.from('app_settings').select('*').eq('key', 'payment_links').single();
    const paymentLinks = settings.value;

    // 2. 松本太郎様のデータを再現
    const appData = {
        venue: normalizeVenue('LIVE視聴（東京・福岡）'),
        social_venue: normalizeVenue('参加不可'),
        participation_type: 'online',
        online_venues: '東京・福岡',
        rank_id: '2', // リピート
        rank_name: 'リピート'
    };

    console.log('--- 検証開始 ---');
    console.log('入力データ:', JSON.stringify(appData, null, 2));
    
    const matched = matchProduct(paymentLinks, appData);
    
    if (matched) {
        console.log('SUCCESS: 商品が見つかりました:', matched.name);
    } else {
        console.log('FAILURE: 商品が見つかりませんでした。');
        
        // 詳細調査: なぜマッチしないのか
        console.log('\n--- 詳細調査 ---');
        const rank2Links = paymentLinks.filter((l: any) => String(l.rank_id) === '2');
        console.log(`ランクID 2 の商品は ${rank2Links.length} 件あります。`);
        
        rank2Links.forEach((l: any, i: number) => {
            console.log(`\n商品[${i}]: ${l.name}`);
            const normalizeBrackets = (s: string) => s.replace(/（/g, '(').replace(/）/g, ')').trim();
            
            const vMatch = normalizeBrackets(l.venue_lecture) === normalizeBrackets(`LIVE視聴(${appData.online_venues})`);
            const sMatch = normalizeBrackets(l.venue_social) === '参加不可' || normalizeBrackets(l.venue_social) === 'ー' || normalizeBrackets(l.venue_social) === '参加しない';
            
            console.log(`  会場マッチ: ${vMatch} (Master: "${l.venue_lecture}" vs Search: "LIVE視聴(${appData.online_venues})")`);
            console.log(`  懇親会マッチ: ${sMatch} (Master: "${l.venue_social}")`);
        });
    }
}

verify();
