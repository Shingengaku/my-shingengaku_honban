export function getPaymentKey(rankName: string, venue: string, social_venue: string): string {
    // 既存のレガシーキー(英語)への対応 (後方互換性)
    const venueMap: Record<string, string> = {
        'tokyo': '東京',
        'fukuoka': '福岡',
        'both': '東京・福岡',
        'none': '参加しない'
    };
    const mappedVenue = venueMap[venue] || venue;
    
    const socialMap: Record<string, string> = {
        'tokyo': '東京',
        'fukuoka': '福岡',
        'both': '東京・福岡',
        'none': '参加しない',
        'ー': 'ー'
    };
    const mappedSocial = socialMap[social_venue] || social_venue;

    let venueStr = mappedVenue;
    // 「LIVE視聴」などは「講演参加」を付加しない、またはそのまま使う
    // ここでは、マスタの会場名がそのまま入ることを想定
    
    let socialStr = mappedSocial;
    if (mappedSocial === '参加しない' || mappedSocial === 'none' || !mappedSocial) {
        socialStr = '懇親会なし';
    } else if (mappedSocial !== 'ー') {
        socialStr = `懇親会: ${mappedSocial}`;
    }

    // 例: 【一般】東京 / 懇親会: 東京
    // または 【一般】LIVE視聴 / ー
    return `【${rankName}】${venueStr} / ${socialStr}`;
}
