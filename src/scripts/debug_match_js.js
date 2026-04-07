const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 判定ロジックの抜粋 (検証用)
function normalizeBrackets(s) {
    if (!s) return '';
    return s.replace(/（/g, '(').replace(/）/g, ')').trim();
}

async function verify() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. 商品マスタ取得
    const { data: settings } = await supabase.from('app_settings').select('*').eq('key', 'payment_links').single();
    const paymentLinks = settings.value;

    // 2. 松本太郎様のデータを再現
    // 判定属性: リピート (rank_id: 2)
    // 参加会場: LIVE視聴（東京・福岡）
    // 懇親会: 参加不可
    const appData = {
        rank_id: '2',
        rank_name: 'リピート',
        venue: 'LIVE視聴（東京・福岡）',
        social_venue: '参加不可',
        participation_type: 'online',
        online_venues: '東京・福岡'
    };

    console.log('--- 検証開始 ---');
    console.log('入力データ:', JSON.stringify(appData, null, 2));

    const searchLectureVenues = [
        `LIVE視聴（${appData.online_venues}）`,
        `LIVE視聴(${appData.online_venues})`,
        'LIVE視聴',
        'LIVE視聴（2会場）'
    ];
    
    const searchSocialVenues = ['ー', '参加しない', '参加不可'];

    console.log('検索講義会場案:', searchLectureVenues);
    console.log('検索懇親会会場案:', searchSocialVenues);

    let matchFound = false;
    for (const lec of searchLectureVenues) {
        for (const soc of searchSocialVenues) {
            const found = paymentLinks.find(p => {
                const vMatch = normalizeBrackets(p.venue_lecture) === normalizeBrackets(lec);
                const sMatch = normalizeBrackets(p.venue_social) === normalizeBrackets(soc);
                const rMatch = String(p.rank_id) === String(appData.rank_id);
                return vMatch && sMatch && rMatch;
            });
            
            if (found) {
                console.log(`\nMATCH SUCCESS!`);
                console.log(`  lec: "${lec}" matched "${found.venue_lecture}"`);
                console.log(`  soc: "${soc}" matched "${found.venue_social}"`);
                console.log(`  rank: "${appData.rank_id}" matched "${found.rank_id}"`);
                console.log(`  Product Name: "${found.name}"`);
                matchFound = true;
                break;
            }
        }
        if (matchFound) break;
    }

    if (!matchFound) {
        console.log('\nMATCH FAILURE: 一致する商品が見つかりませんでした。');
        
        console.log('\n--- ランク2の商品一覧 ---');
        const rank2Links = paymentLinks.filter(l => String(l.rank_id) === '2');
        rank2Links.forEach(l => {
            console.log(`- ${l.name}`);
            console.log(`  v_lec: "${l.venue_lecture}" (Normalized: "${normalizeBrackets(l.venue_lecture)}")`);
            console.log(`  v_soc: "${l.venue_social}" (Normalized: "${normalizeBrackets(l.venue_social)}")`);
        });
    }
}

verify();
