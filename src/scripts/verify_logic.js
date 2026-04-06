
// venueUtils.ts のロジックを抽出して検証
const VENUE_MAP = {
    'tokyo': '東京',
    'fukuoka': '福岡',
    'both': '東京・福岡',
    'none': '参加しない'
};

function normalizeVenue(v) {
    if (!v) return '参加しない';
    if (VENUE_MAP[v]) return VENUE_MAP[v];
    if (v === '参加しません' || v === 'なし') return '参加しない';
    if (v === 'LIVE視聴（2会場）' || v === 'LIVE視聴(2会場)') return 'LIVE視聴';
    if (v === '両方参加') return '東京・福岡';
    return v;
}

function matchProduct(paymentLinks, appData) {
    const normalizedVenue = normalizeVenue(appData.venue);
    const normalizedSocial = normalizeVenue(appData.social_venue);
    const participationType = appData.participation_type || 'venue';

    return paymentLinks.find(p => {
        let venueMatch = false;
        if (participationType === 'online') {
            venueMatch = (p.venue_lecture === 'LIVE視聴'); 
        } else {
            venueMatch = (p.venue_lecture === normalizedVenue);
        }

        let socialMatch = false;
        if (participationType === 'online') {
            socialMatch = (p.venue_social === 'ー');
        } else {
            socialMatch = (p.venue_social === normalizedSocial);
        }

        const rankMatch = appData.rank_id
            ? (String(p.rank_id) === String(appData.rank_id))
            : (!p.rank_id && p.name?.includes(appData.rank_name || '一般'));

        return venueMatch && socialMatch && rankMatch;
    }) || null;
}

// テスト用商品マスタ（移行後の想定）
const mockLinks = [
    { name: '【一般】東京 / 懇親会なし', venue_lecture: '東京', venue_social: '参加しない', lecture_fee: 10000, social_fee: 0, rank_id: null },
    { name: '【一般】東京 / 懇親会: 東京', venue_lecture: '東京', venue_social: '東京', lecture_fee: 10000, social_fee: 5000, rank_id: null },
    { name: '【一般】福岡 / 懇親会なし', venue_lecture: '福岡', venue_social: '参加しない', lecture_fee: 10000, social_fee: 0, rank_id: null },
    { name: '【一般】東京・福岡 / 懇親会なし', venue_lecture: '東京・福岡', venue_social: '参加しない', lecture_fee: 20000, social_fee: 0, rank_id: null },
    { name: '【一般】LIVE視聴 / ー', venue_lecture: 'LIVE視聴', venue_social: 'ー', lecture_fee: 10000, social_fee: 0, rank_id: null }
];

console.log('--- Logic Verification ---');
const tests = [
    { name: 'Tokyo Venue (Old Code)', venue: 'tokyo', social: 'none', type: 'venue', rank: '一般' },
    { name: 'Tokyo Venue (New Label)', venue: '東京', social: '参加しない', type: 'venue', rank: '一般' },
    { name: 'Both Venue (Old Code)', venue: 'both', social: 'none', type: 'venue', rank: '一般' },
    { name: 'Online (2 venues case)', venue: 'LIVE視聴（2会場）', social: 'none', type: 'online', rank: '一般' },
    { name: 'Online (Normal)', venue: 'LIVE視聴', social: 'none', type: 'online', rank: '一般' }
];

tests.forEach(t => {
    const p = matchProduct(mockLinks, { venue: t.venue, social_venue: t.social, participation_type: t.type, rank_name: t.rank });
    console.log(`[${t.name}] -> ${p ? p.name : 'FAILED'}`);
});
