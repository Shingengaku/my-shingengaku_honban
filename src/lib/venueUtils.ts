
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
    
    // 「両方参加」などの抽象的な表現を具体的な「東京・福岡」に統一
    if (['両方参加', '両会場参加', '両会場', '懇親会両方', '懇親会参加両方', '懇親会両方参加', '福岡・東京'].some(s => v.includes(s))) {
        return '東京・福岡';
    }

    // 「・」で区切られた複数会場の場合、順序を一定にする（例：福岡・東京 -> 東京・福岡）
    // ただし、「LIVE視聴」などのオプションが含まれる場合は、一つの名称として扱うためスキップする
    if (v.includes('・') && !v.includes('LIVE') && !v.includes('視聴')) {
        const parts = v.split('・').map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            // 重複排除とソート（五十音順）
            return Array.from(new Set(parts)).sort().join('・');
        }
    }
    
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
        searchSocialVenues.push('参加不可'); // マスタ側で「参加不可」となっているケースに対応
    } else {
        searchSocialVenues.push(normalizedSocial);
        if (normalizedSocial === '参加しない') {
            searchSocialVenues.push('ー');
            searchSocialVenues.push('参加不可');
        }
    }

    // 3. 優先順位に従ってマッチング (スーパー照合: スペース、括弧、記号を問わない)
    const superNormalize = (s: string) => {
        if (!s) return '';
        return s.replace(/\s+/g, '') // 全スペース削除
                .replace(/[（［［｛〈]/g, '(') // 各種括弧を半角に
                .replace(/[）］］｝〉]/g, ')')
                .replace(/[・‐－\-、,.]/g, '') // 記号を削除して比較
                .toLowerCase();
    };

    console.log(`[matchProduct] マッチング開始 (Rank: ${appData.rank_id}, Venue: ${normalizedVenue}, Type: ${participationType})`);

    for (const lec of searchLectureVenues) {
        for (const soc of searchSocialVenues) {
            const found = paymentLinks.find(p => {
                const venueMatch = superNormalize(p.venue_lecture || '') === superNormalize(lec || '');
                const socialMatch = superNormalize(p.venue_social || '') === superNormalize(soc || '');
                const rankMatch = String(p.rank_id).trim() === String(appData.rank_id || '').trim();
                return venueMatch && socialMatch && rankMatch;
            });
            if (found) {
                console.log(`[matchProduct] マッチ成功: ${found.name}`);
                return found;
            }
        }
    }

    // 4. 救済マッチング (フォールバック)
    // 講義会場名や懇親会会場名の完全一致がなくても、ランクが合っていて、かつ「LIVE視聴」という単語が含まれていればマッチさせる
    console.log(`[matchProduct] 厳密なマッチなし。救済マッチングを試みます...`);

    const rescueFound = paymentLinks.find(p => {
        const rankMatch = String(p.rank_id).trim() === String(appData.rank_id || '').trim();
        if (!rankMatch) return false;

        const pLec = superNormalize(p.venue_lecture || '');
        if (participationType === 'online') {
            // オンラインの場合、マスタ側に「live」が含まれていればOK
            return pLec.includes('live') || pLec.includes('視聴');
        } else {
            // 会場参加の場合、マスタ側に会場名（例：東京、福岡）が含まれていればOK
            return pLec.includes(superNormalize(normalizedVenue));
        }
    });

    if (rescueFound) {
        console.warn(`[matchProduct] 救済マッチ成功: ${rescueFound.name}`);
        return rescueFound;
    }

    // マッチしなかった理由をコンソールに出力 (デバッグ用)
    if (appData.venue !== '参加しない') {
        console.error('【商品マッチング完全失敗】', {
            入力: {
                ランクID: appData.rank_id,
                講義候補: searchLectureVenues,
                懇親会候補: searchSocialVenues,
                参加タイプ: participationType
            },
            マスタ件数: paymentLinks.length
        });
    }

    return null;
}

/**
 * 指定された会場名がオンライン（LIVE視聴等）かどうかを判定します。
 */
export function isOnlineVenue(venueName: string | null | undefined): boolean {
    if (!venueName) return false;
    const v = venueName.toUpperCase();
    return v.includes('LIVE') || v.includes('ONLINE') || v.includes('オンライン') || v === 'アーカイブ視聴';
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
        // 複数会場の場合は「東京・福岡」自体も選択肢の対象として含めるためのヒント
        const bothName = targetNames.sort().join('・');
        return socialVenues.filter(sv => {
            const n = sv.name;
            return targetNames.some(tn => n.includes(tn) || tn.includes(n)) || n === bothName;
        });
    } else {
        targetNames = [lectureVenueName];
        return socialVenues.filter(sv => {
            return targetNames.some(tn => sv.name.includes(tn) || tn.includes(sv.name));
        });
    }
}
