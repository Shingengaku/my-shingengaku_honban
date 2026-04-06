
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
    if (v === '参加しません' || v === 'なし' || v === 'ー') return '参加しない';
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

    // 2. 検索用の優先順位リストを作成
    const searchLectureVenues: string[] = [];
    if (participationType === 'online') {
        // オンラインの場合は「詳細名」→「標準名」の順で探す
        if (appData.online_venues) {
            searchLectureVenues.push(`LIVE視聴（${appData.online_venues}）`);
            searchLectureVenues.push(`LIVE視聴(${appData.online_venues})`);
        }
        searchLectureVenues.push('LIVE視聴');
        searchLectureVenues.push('LIVE視聴（2会場）');
    } else {
        searchLectureVenues.push(normalizedVenue);
    }

    const searchSocialVenues: string[] = [];
    if (participationType === 'online') {
        searchSocialVenues.push('ー');
        searchSocialVenues.push('参加しない');
    } else {
        searchSocialVenues.push(normalizedSocial);
        if (normalizedSocial === '参加しない') {
            searchSocialVenues.push('ー');
        }
    }

    // 3. 優先順位に従ってマッチング
    for (const lec of searchLectureVenues) {
        for (const soc of searchSocialVenues) {
            const found = paymentLinks.find(p => {
                const venueMatch = (p.venue_lecture === lec);
                const socialMatch = (p.venue_social === soc);
                const rankMatch = String(p.rank_id) === String(appData.rank_id);
                return venueMatch && socialMatch && rankMatch;
            });
            if (found) return found;
        }
    }

    return null;
}

/**
 * 指定された会場名がオンライン（LIVE視聴等）かどうかを判定します。
 */
export function isOnlineVenue(venueName: string | null | undefined): boolean {
    if (!venueName) return false;
    return venueName.includes('LIVE') || venueName === 'アーカイブ視聴';
}

/**
 * 講義会場名から、選択可能な懇親会会場のリストを絞り込みます。
 * 例: "東京・福岡" -> "東京メニュー", "福岡メニュー"を返す
 */
export function getSocialOptionsForLecture<T extends { id: number | string, name: string }>(
    lectureVenueName: string | null | undefined,
    socialVenues: T[]
): T[] {
    if (!lectureVenueName || lectureVenueName === '参加しない') return [];

    let targetNames: string[] = [];
    if (lectureVenueName.includes('・')) {
        targetNames = lectureVenueName.split('・');
    } else {
        targetNames = [lectureVenueName];
    }

    return socialVenues.filter(sv => {
        return targetNames.some(tn => sv.name.includes(tn) || tn.includes(sv.name));
    });
}
