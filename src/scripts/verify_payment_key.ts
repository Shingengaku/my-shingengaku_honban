import { getPaymentKey } from '../lib/payment';

function run() {
    console.log("Testing getPaymentKey:");
    
    const tests = [
        { rank: '一般', venue: 'tokyo', social: 'none', expected: '【一般】東京 / 懇親会なし' },
        { rank: '特進コース', venue: '福岡', social: '福岡', expected: '【特進コース】福岡 / 懇親会: 福岡' },
        { rank: '初年度', venue: '東京・福岡', social: 'both', expected: '【初年度】東京・福岡 / 懇親会: 東京・福岡' },
        { rank: '経営幹部コース', venue: 'LIVE視聴', social: 'none', expected: '【経営幹部コース】LIVE視聴 / 懇親会なし' },
        { rank: '経営幹部コース', venue: 'LIVE視聴', social: 'ー', expected: '【経営幹部コース】LIVE視聴 / ー' },
    ];

    let allPass = true;
    for (const t of tests) {
        const actual = getPaymentKey(t.rank, t.venue, t.social);
        if (actual !== t.expected) {
            console.error(`❌ FAIL: getPaymentKey("${t.rank}", "${t.venue}", "${t.social}") => "${actual}" (Expected: "${t.expected}")`);
            allPass = false;
        } else {
            console.log(`✅ PASS: getPaymentKey("${t.rank}", "${t.venue}", "${t.social}") => "${actual}"`);
        }
    }

    if (allPass) {
        console.log("All tests passed!");
    }
}

run();
