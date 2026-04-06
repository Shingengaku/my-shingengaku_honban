
/**
 * 会場コード（tokyo, fukuoka等）から日本語表示名への標準マッピング
 */
export const VENUE_MAP: Record<string, string> = {
    'tokyo': '東京',
    'fukuoka': '福岡',
    'both': '東京・福岡',
    'none': '参加しない'
};

/**
 * 入力された会場値（コードまたは日本語）を標準の日本語名に正規化します。
 * 「LIVE視聴（2会場）」などの旧表記も「LIVE視聴」に寄せます。
 */
export function normalizeVenue(v: string | null | undefined): string {
    if (!v) return '参加しない';
    
    // コードからの変換
    if (VENUE_MAP[v]) return VENUE_MAP[v];
    
    // 旧表記や表記ゆれの吸収
    if (v === '参加しません' || v === 'なし') return '参加しない';
    if (v === 'LIVE視聴（2会場）' || v === 'LIVE視聴(2会場)') return 'LIVE視聴';
    if (v === '両方参加') return '東京・福岡';
    
    return v;
}

/**
 * メールや画面表示用の会場名（金額なし）を生成します。
 * オンラインの場合は online_venues カラムの情報も付加します。
 */
export function getVenueDisplayName(
    venue: string,
    participationType: string = 'venue',
    onlineVenues?: string | null
): string {
    const normalized = normalizeVenue(venue);
    
    if (participationType === 'online') {
        const base = normalized === '参加しない' ? '参加しない' : 'LIVE視聴';
        if (onlineVenues && base !== '参加しない') {
            return `${base} (${onlineVenues})`;
        }
        return base;
    }
    
    return normalized;
}

/**
 * 商品マスタ（paymentLinks）から、申込データに合致する商品を探します。
 */
export function matchProduct(paymentLinks: any[], appData: {
    venue: string,
    social_venue: string,
    participation_type: string,
    online_venues?: string | null,
    rank_id?: string | null,
    rank_name?: string | null,
    payment_key?: string | null
}) {
    if (!Array.isArray(paymentLinks)) return null;

    const normalizedVenue = normalizeVenue(appData.venue);
    const normalizedSocial = normalizeVenue(appData.social_venue);
    const participationType = appData.participation_type || 'venue';

    // 1. payment_key での直接マッチング（最優先）
    if (appData.payment_key) {
        const found = paymentLinks.find(p => p.name === appData.payment_key || p.key === appData.payment_key);
        if (found) return found;
    }

    // 2. 条件によるマッチング
    return paymentLinks.find(p => {
        // 会場判定
        let venueMatch = false;
        if (participationType === 'online') {
            // オンラインの場合、「LIVE視聴」という名前の会場設定を探す
            venueMatch = (p.venue_lecture === 'LIVE視聴' || p.venue_lecture === 'LIVE視聴（2会場）'); 
        } else {
            // 普通の会場参加
            venueMatch = (p.venue_lecture === normalizedVenue);
        }

        // 懇親会判定
        let socialMatch = false;
        if (participationType === 'online') {
            // オンラインに懇親会はないが、商品マスタ側が「ー」ならマッチとみなす
            socialMatch = (p.venue_social === 'ー');
        } else {
            socialMatch = (p.venue_social === normalizedSocial);
        }

        // ランク判定
        const rankMatch = appData.rank_id
            ? (String(p.rank_id) === String(appData.rank_id))
            : (!p.rank_id && p.name?.includes(appData.rank_name || '一般'));

        return venueMatch && socialMatch && rankMatch;
    }) || null;
}
