
export function getPaymentKey(rankName: string, venue: string, social_venue: string): string {
    const venueStr = venue === 'both' ? '福岡・東京講演参加' : (venue === 'tokyo' ? '東京講演参加' : '福岡講演参加');

    let socialStr = '懇親会なし';
    if (social_venue === 'tokyo') socialStr = '懇親会東京のみ';
    if (social_venue === 'fukuoka') socialStr = '懇親会福岡のみ';
    if (social_venue === 'both') socialStr = '懇親会両方';

    // 例: 【一般】東京講演参加/懇親会東京のみ
    return `【${rankName}】${venueStr}/${socialStr}`;
}
