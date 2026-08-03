const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 環境変数のロード
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found in env');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// 簡易的な漢字正規化 (ダミーまたは簡易実装)
function normalizeName(name, mapping = {}) {
    if (!name) return '';
    let res = name.replace(/[\s\u3000]+/g, '');
    for (const [k, v] of Object.entries(mapping)) {
        res = res.split(k).join(v);
    }
    return res;
}

// 判定ロジック
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

async function runTest() {
    console.log('Fetching data from Supabase...');
    try {
        // データ取得
        const [appsRes, membersRes, ranksRes, settingsRes, venuesRes] = await Promise.all([
            supabaseAdmin.from('applications').select('*, members(*, ranks(*))'),
            supabaseAdmin.from('members').select('*, terms(name)'),
            supabaseAdmin.from('ranks').select('*'),
            supabaseAdmin.from('app_settings').select('*'),
            supabaseAdmin.from('venues').select('*')
        ]);

        if (appsRes.error) throw appsRes.error;
        if (membersRes.error) throw membersRes.error;
        if (ranksRes.error) throw ranksRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (venuesRes.error) throw venuesRes.error;

        const apps = appsRes.data;
        const allMembers = membersRes.data;
        const ranks = ranksRes.data;
        const settings = settingsRes.data;
        const venueList = venuesRes.data;

        // 設定のパース
        const settingsMap = {};
        settings.forEach(row => {
            settingsMap[row.key] = row.value;
        });

        const paymentLinksData = settingsMap.payment_links || [];
        const currentKanjiMap = settingsMap.kanji_mapping || {};
        const lectureDates = settingsMap.lecture_dates || {};
        const lectureEndDates = settingsMap.lecture_end_dates || {};
        const exportMonth = '';
        const exportTermLabel = 'リピート＆本講座';
        const exportCampaignLabel = '水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介';
        const exportRemarks = '';
        const exportPaymentStatus = true;
        const exportShowRemarks = true;

        console.log(`Loaded ${apps.length} applications, ${allMembers.length} members`);

        // メンバーIDから期へのマッピング、およびフォールバック用の名前から期へのマッピング
        const memberIdToGenMap = new Map();
        const memberGenerationMap = new Map();
        allMembers.forEach((m) => {
            const normName = normalizeName(m.name || '', currentKanjiMap);
            const termName = m.terms?.name || '';
            const genMatch = termName.match(/(\d+)/);
            if (genMatch) {
                const genNum = parseInt(genMatch[1], 10);
                memberIdToGenMap.set(m.id, genNum);
                if (normName) {
                    memberGenerationMap.set(normName, genNum);
                }
            }
        });

        // ロジック実行開始
        const getMonthFromDate = (s) => {
            if (!s) return null;
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : (d.getMonth() + 1).toString();
        };

        const formatDateForExcel = (startStr) => {
            if (!startStr) return '';
            const start = new Date(startStr);
            if (isNaN(start.getTime())) return startStr;
            return `${start.getDate()}日`;
        };

        const dateT = lectureDates['tokyo'] || '';
        const dateF = lectureDates['fukuoka'] || '';
        const dateEndT = lectureEndDates['tokyo'] || '';
        const dateEndF = lectureEndDates['fukuoka'] || '';

        const labelT = formatDateForExcel(dateT);
        const labelF = formatDateForExcel(dateF);

        const monthStr = exportMonth || getMonthFromDate(dateT) || getMonthFromDate(dateF) || (new Date().getMonth() + 1).toString();

        console.log(`Target Month: ${monthStr}, Tokyo Date: ${labelT}, Fukuoka Date: ${labelF}`);

        // ExcelJS の Workbook 初期化の再現
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('参加者リスト', {
            pageSetup: {
                paperSize: 9,
                orientation: 'portrait',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0
            }
        });

        // 状態再現用の helper マップ
        const excludedMemberKeys = new Set();
        allMembers.forEach(m => {
            if (m.exclude_from_count) {
                const name = (m.name || '').replace(/[\s\u3000]+/g, '');
                const email = (m.email || '').toLowerCase().trim();
                const key = (name || email) ? `${name}|${email}` : null;
                if (key) excludedMemberKeys.add(key);
            }
        });

        // personStatusMap の再現
        const map = new Map();
        apps.forEach(app => {
            if (!app) return;
            if ((app.payment_status || '').toLowerCase() === 'cancelled') return;

            const name = (app.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (app.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;
            if (!key) return;

            if (excludedMemberKeys.has(key)) return;

            const isKakuninChu = app.tags?.includes('確認中') || (app.applied_rank_name || '').includes('確認中');
            if (isKakuninChu) return;

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

        const personStatusMap = new Map();
        map.forEach((areas, key) => {
            const hasTokyo = areas.venueArea.has('tokyo');
            const hasFukuoka = areas.venueArea.has('fukuoka');
            const isBoth = hasTokyo && hasFukuoka;
            const hasAnyVenue = areas.venueArea.size > 0;
            const hasAnyOnline = areas.onlineArea.size > 0;
            const isHybrid = !isBoth && hasAnyVenue && hasAnyOnline;
            personStatusMap.set(key, { isBoth, isHybrid });
        });

        const tokushinNameSet = new Set(
            allMembers
                .filter(m => m.is_tokushin)
                .map(m => normalizeName(m.name || '', currentKanjiMap))
        );

        const getPriorityByMaster = (app) => {
            const rankName = app.applied_rank_name || app.members?.ranks?.name || '';
            if (rankName.includes('特進') || (app.members?.is_tokushin) || tokushinNameSet.has(normalizeName(app.input_name, currentKanjiMap))) return 1;

            const vL = (app.venue || '').toLowerCase();
            const k = (app.payment_key || '').toLowerCase();
            const tags = app.tags || [];
            const remarks = app.remarks || '';
            const hasIntroducer = vL.includes('紹介') || vL.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介') || tags.includes('ご紹介') || rankName.includes('紹介') || rankName.includes('ご紹介') || (remarks.match(/紹介者:\s*([^\n]+)/) && !remarks.includes('紹介者: なし') && !remarks.includes('紹介者: 未入力'));

            if (hasIntroducer && (rankName.includes('一般') || rankName === '')) {
                return 5;
            }
            if (rankName.includes('紹介') || rankName.includes('ご紹介')) {
                return 5;
            }

            const masterRank = (ranks).find(r => r.name === rankName);
            if (masterRank?.group) {
                if (masterRank.group === 'tokushin') return 1;
                if (masterRank.group === 'terms') return 2;
                if (masterRank.group === 'general') return 3;
                if (masterRank.group === 'executive') return 4;
                if (masterRank.group === 'referral') return 5;
            }

            if (rankName.includes('一般')) return 3;
            if (rankName.includes('経営幹部')) return 4;

            return 2;
        };

        const getMemberInfo = (app) => {
            const nameKey = `${(app.input_name || '').replace(/[\s\u3000]+/g, '')}|${(app.input_email || '').toLowerCase().trim()}`;
            const personStatus = personStatusMap.get(nameKey);

            const isKakuninChu = app.tags?.includes('確認中') || (app.applied_rank_name || '').includes('確認中');
            let name = app.input_name + 'さま';
            if (isKakuninChu) {
                name += ' (要確認)';
            }
            let introText = '';
            let hasIntroducer = false;

            const remarks = app.remarks || '';
            const introMatch = remarks.match(/紹介者:\s*([^\n]+)/);
            if (introMatch && !introMatch[1].includes('なし') && !introMatch[1].includes('未入力')) {
                let introName = introMatch[1].trim();
                introName = introName.replace(/[様さまさん\s]+$/, '');

                if (introName === '神言学アカデミー事務局' || introName === '事務局') {
                    introText = `(事務局紹介)`;
                } else {
                    introName += 'さま';
                    introText = `(${introName}ご紹介)`;
                }
                hasIntroducer = true;
            }

            let rawGen = app.members?.generation;
            // 紐付けがあるが generation が null の場合、マスタの term_id (memberIdToGenMap) から補完
            if ((rawGen === undefined || rawGen === null) && app.members) {
                rawGen = memberIdToGenMap.get(app.members.id) ?? undefined;
            }
            // 紐付けがない場合、名前ベースでマスタから期を補完
            if ((rawGen === undefined || rawGen === null) && !app.members) {
                const nameKey = normalizeName(app.input_name, currentKanjiMap);
                rawGen = memberGenerationMap.get(nameKey) ?? undefined;
            }
            const gen = (rawGen !== undefined && rawGen !== null) ? Number(rawGen) : 99;
            const term = gen === 99 ? '' : `${gen}期`;
            const furigana = app.members?.furigana || app.input_furigana || '';

            const isBoth = personStatus?.isBoth || false;
            const isHybrid = personStatus?.isHybrid || false;

            const priority = getPriorityByMaster(app);

            return { name, introText, term, furigana, isBoth, isHybrid, gen, priority, paymentStatus: app.payment_status, hasIntroducer };
        };

        const normalizeKana = (str) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
        const sorterName = (a, b) => normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
        const sorterTerm = (a, b) => {
            const genA = Number(a.gen);
            const genB = Number(b.gen);
            if (genA !== genB) return genA - genB;
            return normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
        };

        const excelExcludedKeys = new Set(
            allMembers
                .filter((m) => m.exclude_from_count)
                .map((m) => {
                    const name = (m.name || '').replace(/[\s\u3000]+/g, '');
                    const email = (m.email || '').toLowerCase().trim();
                    return (name || email) ? `${name}|${email}` : null;
                })
                .filter(Boolean)
        );
        const allValidApps = apps.filter(a => {
            if ((a.payment_status || '').toLowerCase() === 'cancelled') return false;
            const name = (a.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (a.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;
            if (key && excelExcludedKeys.has(key)) return false;
            return true;
        });

        const getDedupeKey = (a) => `${normalizeName(a.input_name, currentKanjiMap)}|${(a.input_email || '').toLowerCase().trim()}`;

        const listApps = {
            tokyo: [],
            fukuoka: [],
            onlineTokyo: [],
            onlineFukuoka: [],
            others: []
        };

        allValidApps.forEach(app => {
            const status = getParticipationStatus(app, venueList);
            const isTokyo = status.venueArea === 'tokyo' || status.venueArea === 'both';
            const isFukuoka = status.venueArea === 'fukuoka' || status.venueArea === 'both';
            const isOnlineT = status.onlineArea === 'tokyo' || status.onlineArea === 'both';
            const isOnlineF = status.onlineArea === 'fukuoka' || status.onlineArea === 'both';

            if (isTokyo) listApps.tokyo.push(app);
            if (isFukuoka) listApps.fukuoka.push(app);
            if (isOnlineT) listApps.onlineTokyo.push(app);
            if (isOnlineF) listApps.onlineFukuoka.push(app);
            if (!isTokyo && !isFukuoka && !isOnlineT && !isOnlineF) listApps.others.push(app);
        });

        const globalExcludedKeys = new Set();
        const allDupWarnings = [];
        const venueOnlineConflicts = [];

        const checkDup = (appList, label) => {
            const counts = new Map();
            appList.forEach(a => {
                const isKakuninChu = a.tags?.includes('確認中') || (a.applied_rank_name || '').includes('確認中');
                if (isKakuninChu) return;

                const k = getDedupeKey(a);
                if (!counts.has(k)) counts.set(k, []);
                counts.get(k).push(a);
            });
            counts.forEach((appsInKey, key) => {
                if (appsInKey.length >= 2) {
                    globalExcludedKeys.add(key);
                    allDupWarnings.push({
                        name: appsInKey[0].input_name,
                        email: appsInKey[0].input_email || '',
                        venue: label,
                        count: appsInKey.length,
                        excludedApps: appsInKey,
                        key: key
                    });
                }
            });
        };

        checkDup(listApps.tokyo, '東京会場');
        checkDup(listApps.fukuoka, '福岡会場');
        checkDup(listApps.onlineTokyo, 'オンライン（東京）');
        checkDup(listApps.onlineFukuoka, 'オンライン（福岡）');

        const checkConflict = (vApps, oApps, area) => {
            const isNotKakuninChu = (a) => !(a.tags?.includes('確認中') || (a.applied_rank_name || '').includes('確認中'));
            const vKeys = new Map(vApps.filter(isNotKakuninChu).map(a => [getDedupeKey(a), a]));
            const oKeys = new Map(oApps.filter(isNotKakuninChu).map(a => [getDedupeKey(a), a]));

            vKeys.forEach((vApp, key) => {
                if (oKeys.has(key)) {
                    globalExcludedKeys.add(key);
                    const oApp = oKeys.get(key);
                    if (!venueOnlineConflicts.find(c => c.key === key)) {
                        venueOnlineConflicts.push({
                            name: vApp.input_name,
                            email: vApp.input_email || '',
                            area,
                            venueApp: vApp,
                            onlineApp: oApp,
                            key
                        });
                    }
                }
            });
        };

        checkConflict(listApps.tokyo, listApps.onlineTokyo, '東京');
        checkConflict(listApps.fukuoka, listApps.onlineFukuoka, '福岡');

        const filterAndMap = (list) =>
            list.filter(a => !globalExcludedKeys.has(getDedupeKey(a))).map(getMemberInfo);

        const rawTokyo = filterAndMap(listApps.tokyo);
        const rawFukuoka = filterAndMap(listApps.fukuoka);
        const rawOnlineTokyo = filterAndMap(listApps.onlineTokyo);
        const rawOnlineFukuoka = filterAndMap(listApps.onlineFukuoka);
        const rawOthers = filterAndMap(listApps.others);

        const groupList = (list) => {
            return {
                tokushin: list.filter(i => i.priority === 1).sort(sorterTerm),
                terms: list.filter(i => i.priority === 2).sort(sorterTerm),
                general: list.filter(i => i.priority === 3).sort(sorterName),
                executive: list.filter(i => i.priority === 4).sort(sorterName),
                referral: list.filter(i => i.priority === 5).sort(sorterName)
            };
        };
        const tokyoGroups = groupList(rawTokyo);
        const fukuokaGroups = groupList(rawFukuoka);
        const onlineTokyoGroups = groupList(rawOnlineTokyo);
        const onlineFukuokaGroups = groupList(rawOnlineFukuoka);

        const parseDay = (s) => {
            if (!s) return 99;
            const d = new Date(s);
            return isNaN(d.getTime()) ? 99 : d.getDate();
        };

        const dayT = parseDay(dateT);
        const dayF = parseDay(dateF);
        const isFukuokaFirst = dayF < dayT;

        const venueOrder = isFukuokaFirst
            ? [
                { id: 'fukuoka', title: '福岡会場', date: labelF, groups: fukuokaGroups, count: rawFukuoka.length, colOffset: 0 },
                { id: 'tokyo', title: '東京会場', date: labelT, groups: tokyoGroups, count: rawTokyo.length, colOffset: 5 }
            ]
            : [
                { id: 'tokyo', title: '東京会場', date: labelT, groups: tokyoGroups, count: rawTokyo.length, colOffset: 0 },
                { id: 'fukuoka', title: '福岡会場', date: labelF, groups: fukuokaGroups, count: rawFukuoka.length, colOffset: 5 }
            ];

        const onlineOrder = isFukuokaFirst
            ? [
                { id: 'fukuoka', title: 'オンライン（福岡配信分）', groups: onlineFukuokaGroups, list: rawOnlineFukuoka },
                { id: 'tokyo', title: 'オンライン（東京配信分）', groups: onlineTokyoGroups, list: rawOnlineTokyo }
            ]
            : [
                { id: 'tokyo', title: 'オンライン（東京配信分）', groups: onlineTokyoGroups, list: rawOnlineTokyo },
                { id: 'fukuoka', title: 'オンライン（福岡配信分）', groups: onlineFukuokaGroups, list: rawOnlineFukuoka }
            ];

        const colWidths = exportPaymentStatus ? [4, 20, 5, 8] : [4, 20, 6];
        const colsPerVenue = colWidths.length;
        const spacerWidth = 2;

        const columnsConfig = [];
        for (let i = 0; i < 3; i++) {
            colWidths.forEach(w => columnsConfig.push({ width: w }));
            if (i < 2) columnsConfig.push({ width: spacerWidth });
        }
        ws.columns = columnsConfig;

        const totalCols = (colsPerVenue * 3) + 2;
        const getColLetter = (n) => String.fromCharCode(65 + n - 1);
        const lastColLetter = getColLetter(totalCols);

        const totalListedCount = rawTokyo.length + rawFukuoka.length + rawOnlineTokyo.length + rawOnlineFukuoka.length + rawOthers.length;
        const bothCount = Array.from(new Set(
            [...rawTokyo, ...rawFukuoka].filter(i => i.isBoth).map(i => i.name + i.furigana)
        )).length;

        ws.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `神言学集中講座 ${monthStr}月 (名簿掲載数: ${totalListedCount}名${bothCount > 0 ? ` / 両会場参加: ${bothCount}名` : ''})`;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center' };
        titleCell.border = { bottom: { style: 'thick' } };

        ws.getRow(2).height = 40;

        venueOrder.forEach((v, idx) => {
            const startCol = idx * (colsPerVenue + 1) + 1;
            const endCol = startCol + colsPerVenue - 1;
            const cellRef = ws.getRow(2).getCell(startCol);
            ws.mergeCells(2, startCol, 2, endCol);
            cellRef.value = `${v.title} ${monthStr}月${v.date}\n参加者: ${v.count}名`;
            cellRef.font = { bold: true };
            cellRef.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
        });

        const onlineStartCol = 2 * (colsPerVenue + 1) + 1;
        const onlineEndCol = onlineStartCol + colsPerVenue - 1;
        ws.mergeCells(2, onlineStartCol, 2, onlineEndCol);
        ws.getCell(2, onlineStartCol).value = `オンライン配信\n申込者: ${rawOnlineTokyo.length + rawOnlineFukuoka.length}名`;
        ws.getCell(2, onlineStartCol).font = { bold: true };
        ws.getCell(2, onlineStartCol).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
        ws.getCell(2, onlineStartCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

        console.log('Start rendering blocks...');

        const renderBlock = (startRow, colOffset, title, data, startSeq, isTitleOnly = false, themeColor) => {
            let currentRow = startRow;
            const getBorder = (type = 'all') => {
                const borderStyle = { style: 'thin', color: { argb: 'FF000000' } };
                if (type === 'top-half') return { top: borderStyle, left: borderStyle, right: borderStyle };
                if (type === 'bottom-half') return { bottom: borderStyle, left: borderStyle, right: borderStyle };
                return { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
            };

            const titleCellRef = ws.getRow(currentRow).getCell(colOffset + 1);
            ws.mergeCells(currentRow, colOffset + 1, currentRow, colOffset + colsPerVenue);
            titleCellRef.value = title;
            titleCellRef.alignment = { vertical: 'middle', horizontal: 'center' };

            const currentTitleColor = themeColor || (title.includes('配信分') ? 'FFD9EAD3' : 'FFD3D3D3');
            const finalHeaderColor = (!themeColor && title.includes('東京配信分')) ? 'FFCFE2F3' : currentTitleColor;

            titleCellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: finalHeaderColor } };
            titleCellRef.font = { bold: true };
            titleCellRef.border = getBorder();
            currentRow++;

            if (isTitleOnly) return { nextRow: currentRow, nextSeq: startSeq };

            const hRow = ws.getRow(currentRow);
            const headers = exportPaymentStatus ? ['No', '氏名', '期', '決済'] : ['No', '氏名', '期'];
            headers.forEach((h, i) => {
                const c = hRow.getCell(colOffset + 1 + i);
                c.value = h;
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                c.border = getBorder();
                c.alignment = { horizontal: 'center' };
            });
            currentRow++;

            let currentSeq = startSeq;
            if (data.length === 0) {
                const r = ws.getRow(currentRow);
                for (let i = 0; i < colsPerVenue; i++) {
                    const c = r.getCell(colOffset + 1 + i);
                    c.value = '-';
                    c.border = getBorder();
                    c.alignment = { horizontal: 'center' };
                }
                currentRow++;
            } else {
                data.forEach((d) => {
                    const statusLabels = { paid: '済み', unpaid: '未決済' };
                    if (d.hasIntroducer) {
                        ws.mergeCells(currentRow, colOffset + 1, currentRow + 1, colOffset + 1);
                        ws.mergeCells(currentRow, colOffset + 3, currentRow + 1, colOffset + 3);
                        if (exportPaymentStatus) {
                            ws.mergeCells(currentRow, colOffset + 4, currentRow + 1, colOffset + 4);
                        }

                        const c1 = ws.getCell(currentRow, colOffset + 1);
                        const c2_1 = ws.getCell(currentRow, colOffset + 2);
                        const c2_2 = ws.getCell(currentRow + 1, colOffset + 2);
                        const c3 = ws.getCell(currentRow, colOffset + 3);
                        const c4 = exportPaymentStatus ? ws.getCell(currentRow, colOffset + 4) : null;

                        c1.value = currentSeq++;
                        c1.alignment = { horizontal: 'center', vertical: 'middle' };
                        c2_1.value = d.name;
                        c2_1.alignment = { vertical: 'bottom', wrapText: false };
                        c2_2.value = d.introText;
                        c2_2.alignment = { vertical: 'top', wrapText: true };
                        c3.value = d.term;
                        c3.alignment = { horizontal: 'center', vertical: 'middle' };
                        if (c4) {
                            c4.value = statusLabels[d.paymentStatus] || '';
                            c4.alignment = { horizontal: 'center', vertical: 'middle' };
                        }

                        const borderCells = [c1, c3];
                        if (c4) borderCells.push(c4);
                        borderCells.forEach(c => { c.border = getBorder(); });
                        c2_1.border = getBorder('top-half');
                        c2_2.border = getBorder('bottom-half');

                        ws.getCell(currentRow + 1, colOffset + 1).border = getBorder();
                        ws.getCell(currentRow + 1, colOffset + 3).border = getBorder();
                        if (exportPaymentStatus) {
                            ws.getCell(currentRow + 1, colOffset + 4).border = getBorder();
                        }
                        currentRow += 2;
                    } else {
                        const r = ws.getRow(currentRow);
                        const c1 = r.getCell(colOffset + 1);
                        const c2 = r.getCell(colOffset + 2);
                        const c3 = r.getCell(colOffset + 3);

                        c1.value = currentSeq++;
                        c1.alignment = { horizontal: 'center', vertical: 'middle' };
                        c2.value = d.name;
                        c2.alignment = { wrapText: false, vertical: 'middle' };
                        c3.value = d.term;
                        c3.alignment = { horizontal: 'center', vertical: 'middle' };

                        const borderCells = [c1, c2, c3];
                        if (exportPaymentStatus) {
                            const c4 = r.getCell(colOffset + 4);
                            c4.value = statusLabels[d.paymentStatus] || '';
                            c4.alignment = { horizontal: 'center', vertical: 'middle' };
                            borderCells.push(c4);
                        }
                        borderCells.forEach(c => { c.border = getBorder(); });
                        currentRow++;
                    }
                });
            }
            return { nextRow: currentRow, nextSeq: currentSeq };
        };

        const startRow = 4;
        let maxRow = 4;

        venueOrder.forEach((v, idx) => {
            const colOffset = idx * (colsPerVenue + 1);
            let rV = startRow;
            let seqV = 1;
            let resV = renderBlock(rV, colOffset, '特進', v.groups.tokushin, seqV);
            rV = resV.nextRow + 1; seqV = resV.nextSeq;

            resV = renderBlock(rV, colOffset, exportTermLabel, v.groups.terms, seqV);
            rV = resV.nextRow + 1; seqV = resV.nextSeq;

            resV = renderBlock(rV, colOffset, '一般 (未受講)', v.groups.general, seqV);
            rV = resV.nextRow + 1; seqV = resV.nextSeq;

            resV = renderBlock(rV, colOffset, '経営幹部', v.groups.executive, seqV);
            rV = resV.nextRow + 1; seqV = resV.nextSeq;

            resV = renderBlock(rV, colOffset, exportCampaignLabel, v.groups.referral, seqV);
            rV = resV.nextRow;
            if (rV > maxRow) maxRow = rV;
        });

        let rO = startRow;
        let seqO = 1;
        const onlineColOffset = 2 * (colsPerVenue + 1);

        onlineOrder.forEach((o, idx) => {
            const theme = o.title.includes('東京配信分') ? 'FFCFE2F3' :
                o.title.includes('福岡配信分') ? 'FFD9EAD3' : undefined;

            let resO = renderBlock(rO, onlineColOffset, o.title, [], 0, true, theme);
            rO = resO.nextRow;

            if (o.list.length > 0) {
                resO = renderBlock(rO, onlineColOffset, '特進', o.groups.tokushin, seqO, false, theme);
                rO = resO.nextRow + 1; seqO = resO.nextSeq;
                resO = renderBlock(rO, onlineColOffset, exportTermLabel, o.groups.terms, seqO, false, theme);
                rO = resO.nextRow + 1; seqO = resO.nextSeq;
                resO = renderBlock(rO, onlineColOffset, '一般 (未受講)', o.groups.general, seqO, false, theme);
                rO = resO.nextRow + 1; seqO = resO.nextSeq;
                resO = renderBlock(rO, onlineColOffset, '経営幹部', o.groups.executive, seqO, false, theme);
                rO = resO.nextRow + 1; seqO = resO.nextSeq;
                resO = renderBlock(rO, onlineColOffset, exportCampaignLabel, o.groups.referral, seqO, false, theme);
                rO = resO.nextRow; seqO = resO.nextSeq;
            }
            if (idx === 0) rO++;
        });

        if (rO > maxRow) maxRow = rO;

        if (rawOthers.length > 0) {
            maxRow += 2;
            const othersGroup = groupList(rawOthers);
            const resOthers = renderBlock(maxRow, 0, '⚠️ 判定不能（会場名を確認してください）', othersGroup.terms, 1);
            maxRow = resOthers.nextRow;
        }

        ws.getRow(1).height = 30;

        if (exportShowRemarks && exportRemarks) {
            const remarksRow = maxRow + 2;
            ws.mergeCells(`A${remarksRow}:${lastColLetter}${remarksRow}`);
            const remarksCell = ws.getCell(`A${remarksRow}`);
            remarksCell.value = exportRemarks;
            remarksCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            remarksCell.border = {
                top: { style: 'medium' },
                left: { style: 'medium' },
                bottom: { style: 'medium' },
                right: { style: 'medium' }
            };
            const newlineCount = (exportRemarks.match(/\n/g) || []).length;
            ws.getRow(remarksRow).height = Math.max(60, (newlineCount + 1) * 15 + 10);
            maxRow = remarksRow + 1;
        }

        const hasAnyExclusion = allDupWarnings.length > 0 || venueOnlineConflicts.length > 0;
        if (hasAnyExclusion) {
            const secRow = maxRow + 2;
            ws.mergeCells(`A${secRow}:${lastColLetter}${secRow}`);
            const secCell = ws.getCell(`A${secRow}`);
            secCell.value = '【更新版】リストから除外されたお申し込み一覧';
            secCell.font = { bold: true, size: 12, color: { argb: 'FF7B0000' } };
            secCell.alignment = { horizontal: 'left', vertical: 'middle' };
            secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
            secCell.border = {
                top: { style: 'thick', color: { argb: 'FFCC0000' } },
                bottom: { style: 'medium', color: { argb: 'FFCC0000' } },
                left: { style: 'thick', color: { argb: 'FFCC0000' } },
                right: { style: 'thick', color: { argb: 'FFCC0000' } }
            };
            ws.getRow(secRow).height = 22;

            const tblHeaderRow = secRow + 1;
            const tblHeaders = ['除外理由', '氏名', '申込①内容', '申込②内容'];

            let tblColWidths;
            if (totalCols === 14) {
                tblColWidths = [2, 4, 4, 4];
            } else {
                tblColWidths = [2, 3, 3, 3];
            }

            const tblHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF990000' } };
            let colStart = 1;
            tblHeaders.forEach((h, i) => {
                const span = tblColWidths[i];
                ws.mergeCells(tblHeaderRow, colStart, tblHeaderRow, colStart + span - 1);
                const c = ws.getCell(tblHeaderRow, colStart);
                c.value = h;
                c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.fill = tblHeaderFill;
                c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                colStart += span;
            });
            ws.getRow(tblHeaderRow).height = 18;

            let dataRow = tblHeaderRow + 1;
            const fillYellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
            const fillOrange = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
            const thinBorder = { style: 'thin' };
            const cellBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

            const writeDataRow = (cols, fill) => {
                let cs = 1;
                tblColWidths.forEach((span, i) => {
                    ws.mergeCells(dataRow, cs, dataRow, cs + span - 1);
                    const c = ws.getCell(dataRow, cs);
                    c.value = cols[i] || '';
                    c.font = { size: 9 };
                    c.alignment = {
                        horizontal: i === 0 || i === 1 ? 'center' : 'left',
                        vertical: 'middle',
                        wrapText: true
                    };
                    c.fill = fill;
                    c.border = cellBorder;
                    cs += span;
                });
                ws.getRow(dataRow).height = 28;
                dataRow++;
            };

            allDupWarnings.forEach(w => {
                const apps1 = w.excludedApps[0];
                const apps2 = w.excludedApps[1];
                const fmt = (a) => a
                    ? `${a.venue || ''}${a.participation_type === 'online' ? '（オンライン）' : '（会場）'} / ${a.applied_rank_name || ''}`
                    : '';
                writeDataRow([
                    `同一${w.venue}に重複申込`,
                    `${w.name}さま`,
                    fmt(apps1),
                    fmt(apps2)
                ], fillYellow);
            });

            venueOnlineConflicts.forEach(c => {
                const fmtV = `${c.venueApp.venue || c.area + '会場'}（リアル） / ${c.venueApp.applied_rank_name || ''}`;
                const fmtO = `${c.onlineApp.venue || c.area + 'オンライン'}（配信） / ${c.onlineApp.applied_rank_name || ''}`;
                writeDataRow([
                    `${c.area}：会場＋オンライン同時申込`,
                    `${c.name}さま`,
                    fmtV,
                    fmtO
                ], fillOrange);
            });

            maxRow = dataRow;
        }

        const buf = await wb.xlsx.writeBuffer();
        fs.writeFileSync(path.join(__dirname, 'test_output.xlsx'), buf);
        console.log('Success! Excel file generated at test_output.xlsx');
    } catch (e) {
        console.error('EXPORT ERROR ENCOUNTERED:', e);
    }
}

runTest();
