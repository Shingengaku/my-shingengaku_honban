
const apps = [
    {"id":"275b1420-38e3-46c7-b966-e372f3032251","input_name":"今越宏明","input_email":"info@omdjp.com","venue":"東京","online_venues":null,"participation_type":"venue","payment_status":"paid"}, 
    {"id":"5f47173a-f615-4739-8c17-c9cd36b218ed","input_name":"今越宏明","input_email":"info@omdjp.com","venue":"LIVE視聴","online_venues":"福岡","participation_type":"online","payment_status":"paid"}
];

const venueList = [
    { name: '東京', type: 'lecture', area: 'tokyo' },
    { name: '福岡', type: 'lecture', area: 'fukuoka' }
];

const getParticipationStatus = (app, venueList = []) => {
    const venueName = (app.venue || '').trim();
    const onlineVenueInput = (app.online_venues || '').trim();
    const pType = (app.participation_type || '').toLowerCase().trim();

    const onlineKeywords = ['オンライン', 'LIVE', 'ライブ', '視聴', 'アーカイブ', '配信'];
    const hasOnlineKeyword = onlineKeywords.some(k => venueName.toUpperCase().includes(k.toUpperCase()));
    const isExplicitOnline = pType === 'online' || hasOnlineKeyword;

    let venueArea = null;
    let onlineArea = null;

    if (isExplicitOnline || onlineVenueInput) {
        const v = (onlineVenueInput || venueName).toUpperCase();
        if (v.includes('東京') && v.includes('福岡')) onlineArea = 'both';
        else if (v.includes('福岡')) onlineArea = 'fukuoka';
        else if (v.includes('東京')) onlineArea = 'tokyo';
        else onlineArea = 'tokyo'; 
    }

    if (!isExplicitOnline) {
        const v = venueName.toUpperCase();
        const masterVenue = venueList.find(mv => mv.name === venueName && mv.type === 'lecture');
        if (masterVenue?.area && ['tokyo', 'fukuoka', 'both'].includes(masterVenue.area)) {
            venueArea = masterVenue.area;
        } else if (v.includes('東京') && v.includes('福岡')) {
            venueArea = 'both';
        } else if (v.includes('福岡')) {
            venueArea = 'fukuoka';
        } else if (v.includes('東京')) {
            venueArea = 'tokyo';
        }
    }

    return { venueArea, onlineArea };
};

const map = new Map();
apps.forEach(app => {
    if ((app.payment_status || '').toLowerCase() === 'cancelled') return;
    const name = (app.input_name || '').replace(/\s+/g, '');
    const email = (app.input_email || '').toLowerCase().trim();
    const key = `${name}|${email}`;
    if (!key || key === '|') return;

    if (!map.has(key)) map.set(key, { venueArea: new Set(), onlineArea: new Set() });
    const status = getParticipationStatus(app, venueList);
    const entry = map.get(key);
    
    if (status.venueArea === 'both') { 
        entry.venueArea.add('tokyo'); 
        entry.venueArea.add('fukuoka'); 
    } else if (status.venueArea) {
        entry.venueArea.add(status.venueArea);
    }

    if (status.onlineArea === 'both') { 
        entry.onlineArea.add('tokyo'); 
        entry.onlineArea.add('fukuoka'); 
    } else if (status.onlineArea) {
        entry.onlineArea.add(status.onlineArea);
    }
});

const result = new Map();
map.forEach((areas, key) => {
    const hasTokyo = areas.venueArea.has('tokyo');
    const hasFukuoka = areas.venueArea.has('fukuoka');
    const isBoth = hasTokyo && hasFukuoka;
    
    const hasAnyVenue = areas.venueArea.size > 0;
    const hasAnyOnline = areas.onlineArea.size > 0;
    const isHybrid = !isBoth && hasAnyVenue && hasAnyOnline;
    
    const debug = `V:[${Array.from(areas.venueArea).join(',')}] O:[${Array.from(areas.onlineArea).join(',')}]`;
    result.set(key, { isBoth, isHybrid, debug });
});

console.log(result);
