
// Simulation of the Excel Export Logic

const mockApps = [
    {
        id: '1', input_name: 'Tokyo Generic', venue: '東京', payment_key: 'General',
        members: { generation: 1, ranks: { name: '一般' } }
    },
    {
        id: '2', input_name: 'Fukuoka Generic', venue: '福岡', payment_key: 'General',
        members: { generation: 1, ranks: { name: '一般' } }
    },
    {
        id: '3', input_name: 'Referral User 1', venue: '東京', payment_key: 'ご紹介',
        members: { generation: 99, ranks: { name: '一般' } }
    },
    {
        id: '4', input_name: 'Referral User 2', venue: '福岡 (紹介)', payment_key: 'Standard',
        members: { generation: 99, ranks: { name: '一般' } }
    },
    {
        id: '5', input_name: 'Tokushin User', venue: '東京', payment_key: 'Tokushin',
        members: { generation: 1, is_tokushin: true, ranks: { name: '特進' } }
    },
    {
        id: '6', input_name: 'Conflict User (Tokyo Venue, Fukuoka Key)', venue: '東京', payment_key: 'ご紹介キャンペーン（福岡）',
        members: { generation: 99, ranks: { name: '一般' } }
    },
    {
        id: '7', input_name: 'Both User', venue: '東京・福岡', payment_key: 'Both',
        members: { generation: 99, ranks: { name: '一般' } }
    }
];

// Logic copy-pasted and adapted from page.tsx (Updated with Exclusion)
const getMemberInfo = (app) => {
    let name = app.input_name + 'さま';
    const gen = app.members?.generation || 99;
    const term = gen === 99 ? '' : `${gen}期`;
    const furigana = app.members?.furigana || app.input_furigana || '';
    const vL = app.venue || '';
    const paymentKey = app.payment_key || '';

    let priority = 2; // Default to Terms
    const rankName = app.applied_rank_name || app.members?.ranks?.name || '';
    const isTokushin = app.members?.is_tokushin || rankName.includes('特進');

    // 優先度判定
    if (isTokushin) {
        priority = 1;
    } else if (rankName.includes('経営幹部')) {
        priority = 3;
    } else if (vL.includes('紹介') || vL.includes('ご紹介') || paymentKey.includes('紹介') || paymentKey.includes('ご紹介')) {
        // 紹介 (GoGo 55000)
        priority = 4;
    }

    return { name, term, priority, rankName, vL, paymentKey };
};

const rawTokyo = mockApps.filter(a => {
    const v = a.venue || '';
    const k = a.payment_key || '';

    // Safety: If venue is explicitly Fukuoka only, exclude from Tokyo list
    if ((v.includes('福岡') || v.includes('fukuoka')) &&
        !v.includes('東京') && !v.includes('tokyo') && !v.includes('both') && !v.includes('両方')) {
        return false;
    }

    const isStandard = v.includes('東京') || v.includes('tokyo') || v.includes('both');
    const isReferral = (v.includes('紹介') || v.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介')) &&
        (v.includes('東京') || k.includes('東京') || v.includes('Tokyo') || k.includes('Tokyo'));
    return isStandard || isReferral;
}).map(getMemberInfo);

const rawFukuoka = mockApps.filter(a => {
    const v = a.venue || '';
    const k = a.payment_key || '';

    // Safety: If venue is explicitly Tokyo only, exclude from Fukuoka list
    if ((v.includes('東京') || v.includes('tokyo')) &&
        !v.includes('福岡') && !v.includes('fukuoka') && !v.includes('both') && !v.includes('両方')) {
        return false;
    }

    const isStandard = v.includes('福岡') || v.includes('fukuoka') || v.includes('both');
    const isReferral = (v.includes('紹介') || v.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介')) &&
        (v.includes('福岡') || k.includes('福岡') || v.includes('Fukuoka') || k.includes('Fukuoka'));
    return isStandard || isReferral;
}).map(getMemberInfo);

console.log('--- Tokyo List ---');
rawTokyo.forEach(m => console.log(`${m.name} (Priority: ${m.priority})`));

console.log('--- Fukuoka List ---');
rawFukuoka.forEach(m => console.log(`${m.name} (Priority: ${m.priority})`));
