
// Standalone final logic check with more debug
function normalizeVenue(v) {
    if (!v) return '参加しない';
    if (v === 'tokyo') return '東京';
    if (v === 'fukuoka') return '福岡';
    if (v === 'both' || v === '両方参加') return '東京・福岡';
    if (v === 'none' || v === '参加しません') return '参加しない';
    return v;
}

function matchProduct(paymentLinks, appData) {
    const normalizedVenue = normalizeVenue(appData.venue);
    const participationType = appData.participation_type || 'venue';
    const normalizedSocial = normalizeVenue(appData.social_venue);

    const searchLectureVenues = [];
    if (participationType === 'online') {
        if (appData.online_venues) {
            searchLectureVenues.push(`LIVE視聴（${appData.online_venues}）`);
            searchLectureVenues.push(`LIVE視聴(${appData.online_venues})`);
        }
        searchLectureVenues.push('LIVE視聴');
    } else {
        searchLectureVenues.push(normalizedVenue);
    }

    const searchSocialVenues = [];
    if (participationType === 'online') searchSocialVenues.push('ー');
    else searchSocialVenues.push(normalizedSocial);

    console.log(`DEBUG: Searching for ${appData.label}: LecVenues=${JSON.stringify(searchLectureVenues)}, SocVenues=${JSON.stringify(searchSocialVenues)}`);

    for (const lec of searchLectureVenues) {
        for (const soc of searchSocialVenues) {
            const found = paymentLinks.find(p => {
                const venueMatch = (p.venue_lecture === lec);
                const socialMatch = (p.venue_social === soc);
                const rankMatch = String(p.rank_id) === String(appData.rank_id);
                return venueMatch && socialMatch && rankMatch;
            });
            if (found) {
                console.log(`DEBUG: Found match for lec='${lec}', soc='${soc}': ${found.name}`);
                return found;
            }
        }
    }
    return null;
}

const mockLinks = [
    { name: '一般・LIVE視聴（共通）', venue_lecture: 'LIVE視聴', venue_social: 'ー', rank_id: 7 },
    { name: '一般・LIVE視聴（東京・福岡）', venue_lecture: 'LIVE視聴（東京・福岡）', venue_social: 'ー', rank_id: 7 },
    { name: '一般・東京会場', venue_lecture: '東京', venue_social: '参加しない', rank_id: 7 },
    { name: 'リピート・東京会場', venue_lecture: '東京', venue_social: '参加しない', rank_id: 2 }
];

console.log('--- Final Logic Test ---');
const tests = [
    { label: 'Normal Venue', venue: '東京', social: 'none', type: 'venue', rank_id: 7, expect: '一般・東京会場' },
    { label: 'Online Basic', venue: 'LIVE視聴', social: 'none', type: 'online', online_venues: '東京', rank_id: 7, expect: '一般・LIVE視聴（共通）' },
    { label: 'Online Specialized', venue: 'LIVE視聴', social: 'none', type: 'online', online_venues: '東京・福岡', rank_id: 7, expect: '一般・LIVE視聴（東京・福岡）' }
];

tests.forEach(t => {
    const p = matchProduct(mockLinks, t);
    const result = p ? p.name : 'FAILED';
    console.log(`[${t.label}] Result: ${result} | Expected: ${t.expect}`);
});
