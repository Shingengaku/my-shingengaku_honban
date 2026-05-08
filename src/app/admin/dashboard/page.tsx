'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DrumTimePicker from '@/components/admin/DrumTimePicker';
import { matchProduct, getVenueDisplayName, isOnlineVenue, getSocialOptionsForLecture, normalizeVenue } from '@/lib/venueUtils';

// 型定義
interface Application {
    id: string;
    created_at: string;
    input_name: string;
    input_furigana: string;
    input_email: string;
    total_amount: number;
    payment_status: 'unpaid' | 'paid' | 'cancelled';
    matched_member_id: string | null;
    applied_rank_name: string;
    venue?: string;
    social_venue?: string;
    attend_social?: boolean;

    remarks?: string; // 備考
    environment?: string; // production | development
    cc_email?: string;
    bcc_email?: string;
    tags?: string[]; // タグの文字列配列
    participation_type?: 'venue' | 'online'; // 参加タイプ
    online_venues?: string | null;
    // リレーション
    members?: {
        generation?: number;
        furigana: string;
        is_tokushin?: boolean;
        ranks?: {
            id: number;
            name: string;
            sort_order: number;
        }
    };
    payment_key?: string; // バックエンドで生成または派生
    is_duplicate_confirmed?: boolean;
    updated_at: string;
}

interface PaymentLinkItem {
    name: string;
    lecture_fee: string;
    social_fee: string;
    key: string;
    url: string;
    venue_lecture?: string;
    venue_social?: string;
    rank_id?: string; // ランクID (照合用)
    product_code?: string;
    group?: 'tokushin' | 'terms' | 'general' | 'executive' | 'referral';
}

interface Rank {
    id: number | string;
    name: string;
    group: 'tokushin' | 'terms' | 'general' | 'executive' | 'referral';
}

interface Venue {
    id: number;
    name: string;
    type: 'lecture' | 'social';
    area: 'tokyo' | 'fukuoka' | 'online';
}

// 複数選択コンポーネント
const MultiSelect = ({ label, options, selected, onChange, width = "w-40" }: { label: string, options: { label: string, value: string }[], selected: Set<string>, onChange: (s: Set<string>) => void, width?: string }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className={`relative ${width}`}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full text-left border rounded px-2 py-2 text-sm flex justify-between items-center bg-white cursor-pointer hover:border-gray-400"
            >
                <span className="truncate block">
                    {selected.size === 0 ? label : `${selected.size}件選択中`}
                </span>
                <span className="text-xs text-gray-500 ml-1">▼</span>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-20 max-h-80 overflow-y-auto mt-1">
                        <div
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center border-b"
                            onClick={() => {
                                if (selected.size === options.length) onChange(new Set());
                                else onChange(new Set(options.map(o => o.value)));
                            }}
                        >
                            <span className="text-xs font-bold text-indigo-600">
                                {selected.size === options.length ? '全て解除' : '全て選択'}
                            </span>
                        </div>
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-50 last:border-0"
                                onClick={() => {
                                    const newSet = new Set(selected);
                                    if (newSet.has(opt.value)) newSet.delete(opt.value);
                                    else newSet.add(opt.value);
                                    onChange(newSet);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(opt.value)}
                                    readOnly
                                    className="pointer-events-none h-4 w-4 text-indigo-600 focus:ring-0"
                                />
                                <span className="text-sm truncate select-none text-gray-700">{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// 判定ロジック群（参照の順序を考慮して最上部に配置、コンポーネント外に定義して安定化）
const getParticipationStatus = (app: any, venueList: any[] = []) => {
    const venueName = (app.venue || '').trim();
    const onlineVenueInput = (app.online_venues || '').trim();
    const pType = (app.participation_type || '').toLowerCase().trim();

    // 強力なキーワード判定 + ユーティリティ使用
    const onlineKeywords = ['オンライン', 'LIVE', 'ライブ', '視聴', 'アーカイブ', '配信'];
    const hasOnlineKeyword = onlineKeywords.some(k => venueName.toUpperCase().includes(k.toUpperCase()));
    const isExplicitOnline = pType === 'online' || hasOnlineKeyword || (typeof isOnlineVenue === 'function' && isOnlineVenue(venueName));

    let venueArea: 'tokyo' | 'fukuoka' | 'both' | null = null;
    let onlineArea: 'tokyo' | 'fukuoka' | 'both' | null = null;

    // 1. オンライン判定
    if (isExplicitOnline || onlineVenueInput) {
        const v = (onlineVenueInput || venueName).toUpperCase();
        if (v.includes('東京') && v.includes('福岡')) onlineArea = 'both';
        else if (v.includes('福岡')) onlineArea = 'fukuoka';
        else if (v.includes('東京')) onlineArea = 'tokyo';
        else onlineArea = 'tokyo'; // デフォルト
    }

    // 2. 実会場判定
    // 明示的にオンラインと判定されているレコードであっても、venueに「東京」などの地名が含まれていれば
    // (かつ「LIVE視聴」などのオンラインキーワードが「主」でない場合など) 実会場としてカウントする可能性を考慮。
    // しかし、基本は isExplicitOnline が FALSE の場合のみ実会場としてカウントする（重複防止のため）。
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

export default function AdminDashboard() {
    const VERSION = "2026-04-14-2325";
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid' | 'cancelled'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin/login');
        router.refresh();
    };

    // 高度なフィルター状態(複数選択)
    const [filterRank, setFilterRank] = useState<Set<string>>(new Set());
    const [filterGen, setFilterGen] = useState<Set<string>>(new Set());
    const [filterProduct, setFilterProduct] = useState<Set<string>>(new Set());
    // 新しい会場フィルター
    const [filterVenueLecture, setFilterVenueLecture] = useState<Set<string>>(new Set());
    const [filterVenueSocial, setFilterVenueSocial] = useState<Set<string>>(new Set());
    // オンライン視聴フィルター
    const [filterOnlineOption, setFilterOnlineOption] = useState<Set<string>>(new Set());
    const [filterOnlineArea, setFilterOnlineArea] = useState<Set<string>>(new Set());
    const [filterParticipationType, setFilterParticipationType] = useState<'all' | 'venue' | 'online'>('all');

    // 編集モーダルの状態
    const [editingApp, setEditingApp] = useState<Application | null>(null);
    const [editForm, setEditForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [showModal, setShowModal] = useState(false);

    // 新規登録モーダルの状態
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [creating, setCreating] = useState(false);

    // メールプレビューモーダルの状態
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailPreview, setEmailPreview] = useState<{ subject: string, content: string, email?: string, cc?: string, bcc?: string } | null>(null);

    // 設定モーダルの状態
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkItem[]>([]);
    const [baseSocialFeeTokyo, setBaseSocialFeeTokyo] = useState<number>(11000);
    const [baseSocialFeeFukuoka, setBaseSocialFeeFukuoka] = useState<number>(13000);

    // メールテンプレートの状態
    const [emailTemplate, setEmailTemplate] = useState({ subject: '', body: '' }); // マッチした場合
    const [emailTemplateGeneral, setEmailTemplateGeneral] = useState({ subject: '', body: '' });
    const [emailTemplateFree, setEmailTemplateFree] = useState({ subject: '', body: '' }); // 0円無料の場合
    const [emailTemplateFreeOnline, setEmailTemplateFreeOnline] = useState({ subject: '', body: '' }); // 0円(オンライン)
    const [emailTemplateResend, setEmailTemplateResend] = useState({ subject: '', body: '' });
    const [emailTemplateForgotPass, setEmailTemplateForgotPass] = useState({ subject: '', body: '' });
    const [emailTemplateMultiple, setEmailTemplateMultiple] = useState({ subject: '', body: '' });
    const [selectedTemplateTab, setSelectedTemplateTab] = useState<'matched' | 'general' | 'free' | 'free_online' | 'resend' | 'forgot' | 'multiple' | 'reminder'>('matched');
    const [customResendModal, setCustomResendModal] = useState<{ isOpen: boolean, appId: string | null, subject: string, body: string, email: string }>({ isOpen: false, appId: null, subject: '', body: '', email: '' });

    const [adminEmail, setAdminEmail] = useState('');
    const [adminBccEmail, setAdminBccEmail] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [venueList, setVenueList] = useState<Venue[]>([]);
    const [onlineOptionMaster, setOnlineOptionMaster] = useState<{ id: string, name: string }[]>([]);
    const [ranks, setRanks] = useState<{ id: number, name: string }[]>([]);
    const [termMaster, setTermMaster] = useState<number[]>([]);
    const [applicationActive, setApplicationActive] = useState(true);

    // リマインド関連の状態
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [reminderSending, setReminderSending] = useState(false);
    const [emailTemplateReminderVenuePaid, setEmailTemplateReminderVenuePaid] = useState({ subject: '', body: '' });
    const [emailTemplateReminderVenueUnpaid, setEmailTemplateReminderVenueUnpaid] = useState({ subject: '', body: '' });
    const [emailTemplateReminderOnlinePaid, setEmailTemplateReminderOnlinePaid] = useState({ subject: '', body: '' });
    const [emailTemplateReminderOnlineUnpaid, setEmailTemplateReminderOnlineUnpaid] = useState({ subject: '', body: '' });
    const [onlineViewingLinks, setOnlineViewingLinks] = useState<Record<string, string>>({});
    const [zoomIds, setZoomIds] = useState<Record<string, string>>({});
    const [zoomPasses, setZoomPasses] = useState<Record<string, string>>({});
    const [lectureDates, setLectureDates] = useState<Record<string, string>>({});
    const [lectureEndDates, setLectureEndDates] = useState<Record<string, string>>({});
    const [reminderSettingsTab, setReminderSettingsTab] = useState<'venue' | 'online'>('venue');

    // ソート機能の状態
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // 未申込者確認機能の状態
    const [unappliedMembers, setUnappliedMembers] = useState<any[]>([]);
    const [showUnappliedModal, setShowUnappliedModal] = useState(false);
    const [loadingUnapplied, setLoadingUnapplied] = useState(false);

    // 追加：人物単位の参加状況マップ（名寄せはせず、判定のみで使用）
    const personStatusMap = useMemo(() => {
        try {
            const map = new Map<string, { venueArea: Set<string>, onlineArea: Set<string> }>();
            if (!Array.isArray(apps)) return new Map();

            apps.forEach(app => {
                if (!app) return;
            if ((app.payment_status || '').toLowerCase() === 'cancelled') return;
            
            const name = (app.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (app.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;
            if (!key) return;

            if (!map.has(key)) map.set(key, { venueArea: new Set(), onlineArea: new Set() });
            const status = getParticipationStatus(app, venueList);
            const entry = map.get(key)!;
            
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

        const result = new Map<string, { isBoth: boolean, isHybrid: boolean, debug: string }>();
        map.forEach((areas, key) => {
            const hasTokyo = areas.venueArea.has('tokyo');
            const hasFukuoka = areas.venueArea.has('fukuoka');
            // 実会場が東京・福岡の両方にある場合は「重複（赤）」
            const isBoth = hasTokyo && hasFukuoka;
            
            const hasAnyVenue = areas.venueArea.size > 0;
            const hasAnyOnline = areas.onlineArea.size > 0;
            // 実会場とオンラインの混在（実会場重複がない場合のみ「ハイブリッド（緑）」）
            const isHybrid = !isBoth && hasAnyVenue && hasAnyOnline;
            
            const debug = `V:[${Array.from(areas.venueArea).join(',')}] O:[${Array.from(areas.onlineArea).join(',')}]`;
            result.set(key, { isBoth, isHybrid, debug });
        });
        return result;
        } catch (e) {
            console.error('Error in personStatusMap calculation:', e);
            return new Map<string, { isBoth: boolean, isHybrid: boolean, debug: string }>();
        }
    }, [apps, venueList]);
    const [exportTermLabel, setExportTermLabel] = useState('リピート＆本講座');
    const [exportCampaignLabel, setExportCampaignLabel] = useState('水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介');
    const [exportRemarks, setExportRemarks] = useState('');
    const [exportMonth, setExportMonth] = useState('');

    // Persist Export Settings
    useEffect(() => {
        const savedMonth = localStorage.getItem('shingengaku_export_month');
        if (savedMonth) setExportMonth(savedMonth);

        const savedTermLabel = localStorage.getItem('shingengaku_export_term_label_v2');
        if (savedTermLabel) setExportTermLabel(savedTermLabel);
        
        const savedCampaignLabel = localStorage.getItem('shingengaku_export_campaign_label');
        if (savedCampaignLabel) setExportCampaignLabel(savedCampaignLabel);

        const savedRemarks = localStorage.getItem('shingengaku_export_remarks');
        if (savedRemarks) setExportRemarks(savedRemarks);
    }, []);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_month', exportMonth);
    }, [exportMonth]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_month', exportMonth);
    }, [exportMonth]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_term_label_v2', exportTermLabel);
    }, [exportTermLabel]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_campaign_label', exportCampaignLabel);
    }, [exportCampaignLabel]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_remarks', exportRemarks);
    }, [exportRemarks]);

    // 定数 (UIフォールバック、libをミラーリング)
    const DEFAULT_TEMPLATE = {
        subject: '【神言学】お申込み受付・決済のご案内',
        body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

{{payment_link_section}}`
    };

    const DEFAULT_TEMPLATE_GENERAL = {
        subject: '【神言学】お申込み受付のお知らせ',
        body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
--------------------------------

現在、お客様の条件に合致する自動決済案内が見つかりませんでした（または事務局確認が必要です）。
事務局より別途、正式なご案内メールをお送りいたしますので、今しばらくお待ちください。`
    };

    const DEFAULT_TEMPLATE_FREE = {
        subject: '【神言学】お申込み受付完了のお知らせ',
        body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

当日は会場にてお待ちしております。`
    };

    const DEFAULT_TEMPLATE_FREE_ONLINE = {
        subject: '【神言学】お申込み受付完了のお知らせ',
        body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

オンラインでのご参加、ありがとうございます。
ご視聴に関する詳細につきましては、追ってご連絡させていただきます。`
    };

    const DEFAULT_TEMPLATE_RESEND = {
        subject: '【神言学】【再送】お申込み受付・決済のご案内',
        body: `{{name}} 様

(本メールは管理者による再送です)

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

{{payment_link_section}}`
    };

    const DEFAULT_TEMPLATE_FORGOT_PASS = {
        subject: '【神言学】パスワードリセットのご案内',
        body: `{{username}} 様

パスワードリセットのリクエストを受け付けました。
以下のリンクをクリックして、新しいパスワードを設定してください。

{{reset_link}}

※リンクの有効期限は30分です。`
    };

    const DEFAULT_TEMPLATE_MULTIPLE = {
        subject: '【神言学】複数名でのお申し込みを承りました（事務局からの連絡をお待ちください）',
        body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
複数名でのお申し込みとして、以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}}
--------------------------------

複数名でのお申し込みの場合、合計金額を確認の上、事務局より別途お支払い案内（専用決済リンク等）をメールにてお送りいたします。

お手数をおかけいたしますが、事務局からの次回の連絡をお待ちいただけますようお願い申し上げます。
（本メールでの自動決済は不要です）`
    };

    const DEFAULT_TEMPLATE_REMINDER_VENUE_PAID = {
        subject: '【神言学】講座開催間近のご案内',
        body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n開催が近づいてまいりましたので、改めてご案内申し上げます。\n\n【開催概要】\n日時：{{lecture_date}}\n会場：{{venue}}\n懇親会：{{social_venue}}\n\n当日は会場にてお待ちしております。`
    };

    const DEFAULT_TEMPLATE_REMINDER_VENUE_UNPAID = {
        subject: '【神言学】講座お申込み内容のご確認と決済のお願い',
        body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n開催が近づいてまいりましたが、受講料のご決済がまだ確認できておりません。\n\nお手数ですが、下記リンクよりお手続きをお願いいたします。\n\n▼ご決済リンク\n{{payment_link_section}}\n\n【開催概要】\n日時：{{lecture_date}}\n会場：{{venue}}\n懇親会：{{social_venue}}\n\n当日お会いできることを楽しみにしております。`
    };

    const DEFAULT_TEMPLATE_REMINDER_ONLINE_PAID = {
        subject: '【神言学】オンライン視聴URLのご案内',
        body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\nオンライン視聴用のURLをご案内いたします。\n\n【視聴URL】\n{{viewing_link}}\n\n【ZOOM情報】\n{{zoom_info}}\n\n【開催日時】\n{{lecture_date}}\n\n※開始10分前からアクセス可能です。\n当日は画面越しにお会いできることを楽しみにしております。`
    };

    const DEFAULT_TEMPLATE_REMINDER_ONLINE_UNPAID = {
        subject: '【神言学】オンライン視聴お申込み内容のご確認と決済のお願い',
        body: `{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n開催が近づいてまいりましたが、受講料のご決済がまだ確認できておりません。\n\nご決済確認後、視聴URLを順次お送りいたします。\nお手数ですが、下記リンクよりお手続きをお願いいたします。\n\n▼ご決済リンク\n{{payment_link_section}}\n\n【開催日時】\n{{lecture_date}}\n\n当日お会いできることを楽しみにしております。`
    };

    useEffect(() => {
        fetchApplications();
        fetchRanks(); // ランク惁E��を取得
        fetchOnlineOptions(); // オンラインマスタ取得
        fetchSettings(false); // 設定をロード（モーダルは開かなぁE��E
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                // データの整形 (participation_typeの補完など)
                if (!Array.isArray(data)) { setApps([]); return; }
                const formatted = data.map((d: any) => ({
                    ...d,
                    // タグから推測する場合のロジック (後方互換性)
                    participation_type: d.participation_type || (d.venue && ['LIVE視聴', 'アーカイブ視聴'].some((o: string) => d.venue.includes(o)) ? 'online' : 'venue')
                }));
                setApps(formatted);
            }
        } catch (e) {
            console.error(e);
            alert('データ取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const fetchUnappliedMembers = async () => {
        setLoadingUnapplied(true);
        setShowUnappliedModal(true);
        try {
            const res = await fetch('/api/admin/members', { cache: 'no-store' });
            if (res.ok) {
                const membersData = await res.json();
                
                // 申し込み済みのメンバーIDとメールアドレスのセットを作成（キャンセルを除く）
                const appliedMemberIds = new Set<string>();
                const appliedEmails = new Set<string>();
                
                apps.forEach(app => {
                    if (app.payment_status === 'cancelled') return;
                    if (app.matched_member_id) {
                        appliedMemberIds.add(String(app.matched_member_id));
                    }
                    if (app.input_email) {
                        appliedEmails.add(app.input_email.toLowerCase().trim());
                    }
                });

                // 受講生マスターから、申し込みデータに存在しない人だけを抽出
                const unapplied = membersData.filter((member: any) => {
                    const mId = String(member.id);
                    const mEmail = member.email ? member.email.toLowerCase().trim() : '';
                    
                    if (appliedMemberIds.has(mId)) return false;
                    if (mEmail && appliedEmails.has(mEmail)) return false;
                    return true;
                });
                
                setUnappliedMembers(unapplied);
            } else {
                alert('受講生マスターの取得に失敗しました');
                setShowUnappliedModal(false);
            }
        } catch (e) {
            console.error('Error fetching unapplied members:', e);
            alert('エラーが発生しました');
            setShowUnappliedModal(false);
        } finally {
            setLoadingUnapplied(false);
        }
    };

    const downloadUnappliedCSV = () => {
        if (unappliedMembers.length === 0) return;

        const headers = ['期', '氏名', 'フリガナ', 'メールアドレス', '属性'];
        const rows = unappliedMembers.map(member => [
            member.terms?.name || '',
            member.name || '',
            member.furigana || '',
            member.email || '',
            member.ranks?.name || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Excelで文字化けしないようにBOM(Byte Order Mark)を付与
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `未申込者一覧_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchRanks = async () => {
        try {
            const res = await fetch('/api/admin/ranks');
            if (res.ok) {
                const data = await res.json();
                setRanks(data);
            }
        } catch (e) { console.error(e); }
    };

    const fetchOnlineOptions = async () => {
        try {
            const res = await fetch('/api/admin/online-options');
            if (res.ok) {
                const data = await res.json();
                setOnlineOptionMaster(data);
            }
        } catch (e) { console.error(e); }
    };

    const fetchSettings = async (openModal = true) => {
        try {
            const [settingsRes, venuesRes] = await Promise.all([
                fetch('/api/admin/settings'),
                fetch('/api/admin/venues')
            ]);

            if (settingsRes.ok) {
                try {
                    const data = await settingsRes.json() || {};

                    // 決済リンクを解析
                    let linksArr: PaymentLinkItem[] = [];
                    const val = data.payment_links;

                    if (Array.isArray(val)) {
                        linksArr = val.map((item: any) => ({
                            name: item.name || '',
                            lecture_fee: String(item.lecture_fee || 0),
                            social_fee: String(item.social_fee || 0),
                            key: item.name,
                            url: item.url || '',
                            venue_lecture: item.venue_lecture || '',
                            venue_social: item.venue_social || '',
                            rank_id: item.rank_id ? String(item.rank_id) : undefined,
                            group: item.group || undefined
                        }));
                    } else if (val && typeof val === 'object') {
                        linksArr = Object.entries(val).map(([key, value]) => ({
                            name: '',
                            lecture_fee: '0',
                            social_fee: '0',
                            key,
                            url: String(value),
                            rank_id: undefined
                        }));
                    }

                    setPaymentLinksData(linksArr);

                    // テンプレートをロード
                    setEmailTemplate(data.email_template || DEFAULT_TEMPLATE);
                    setEmailTemplateGeneral(data.email_template_general || DEFAULT_TEMPLATE_GENERAL);
                    setEmailTemplateFree(data.email_template_free || DEFAULT_TEMPLATE_FREE);
                    setEmailTemplateFreeOnline(data.email_template_free_online || DEFAULT_TEMPLATE_FREE_ONLINE);
                    setEmailTemplateResend(data.email_template_resend || DEFAULT_TEMPLATE_RESEND);
                    setEmailTemplateForgotPass(data.email_template_forgot_pass || DEFAULT_TEMPLATE_FORGOT_PASS);
                    setEmailTemplateMultiple(data.email_template_multiple || DEFAULT_TEMPLATE_MULTIPLE);

                    // 基本懇親会費マスタをロード
                    if (data.base_social_fee_tokyo !== undefined) setBaseSocialFeeTokyo(Number(data.base_social_fee_tokyo));
                    if (data.base_social_fee_fukuoka !== undefined) setBaseSocialFeeFukuoka(Number(data.base_social_fee_fukuoka));

                    const tm = data.term_master;
                    if (Array.isArray(tm)) {
                        setTermMaster(tm.map(Number).sort((a: number, b: number) => a - b));
                    }

                    if (venuesRes.ok) {
                        try {
                            const vData = await venuesRes.json();
                            if (Array.isArray(vData)) {
                                setVenueList(vData);
                            }
                        } catch (err) { console.error('Error parsing venues:', err); }
                    }

                    setAdminEmail(data.admin_email || '');
                    setAdminBccEmail(data.admin_bcc_email || '');
                    setTestEmail(data.test_email || '');
                    setApplicationActive(data.application_active !== false); // デフォルトtrue

                // リマインド関連
                const ensureTemplate = (t: any, def: any) => {
                    try {
                        return (t && typeof t === 'object' && t !== null && 'subject' in t && 'body' in t) ? t : def;
                    } catch (e) { return def; }
                };
                setEmailTemplateReminderVenuePaid(ensureTemplate(data.email_template_reminder_venue_paid, DEFAULT_TEMPLATE_REMINDER_VENUE_PAID));
                setEmailTemplateReminderVenueUnpaid(ensureTemplate(data.email_template_reminder_venue_unpaid, DEFAULT_TEMPLATE_REMINDER_VENUE_UNPAID));
                setEmailTemplateReminderOnlinePaid(ensureTemplate(data.email_template_reminder_online_paid, DEFAULT_TEMPLATE_REMINDER_ONLINE_PAID));
                setEmailTemplateReminderOnlineUnpaid(ensureTemplate(data.email_template_reminder_online_unpaid, DEFAULT_TEMPLATE_REMINDER_ONLINE_UNPAID));
                
                const ensureObj = (o: any) => {
                    try {
                        return (o && typeof o === 'object' && o !== null && !Array.isArray(o)) ? o : {};
                    } catch (e) { return {}; }
                };
                setOnlineViewingLinks(ensureObj(data.online_viewing_links));
                setZoomIds(ensureObj(data.zoom_ids));
                setZoomPasses(ensureObj(data.zoom_passes));
                setLectureDates(ensureObj(data.lecture_dates));
                setLectureEndDates(ensureObj(data.lecture_end_dates));

                if (openModal) {
                    setShowSettingsModal(true);
                }
                } catch (err) {
                    console.error('Error parsing settings inner:', err);
                }
            } else {
                if (openModal) alert('設定の取得に失敗しました');
            }
        } catch (e) {
            if (openModal) alert('設定取得失敗');
        }
    };

    const generateKeyCandidates = () => {
        // 明示的に定義された商品名マスタリストを使用
        return paymentLinksData.map(p => p.name).filter(Boolean);
    };
    const keyCandidates = useMemo(() => generateKeyCandidates(), [paymentLinksData]);

    const saveSettings = async () => {
        try {
            const payment_links = paymentLinksData.map(item => ({
                name: item.name,
                lecture_fee: Number(item.lecture_fee),
                social_fee: Number(item.social_fee),
                key: item.name,
                url: item.url,
                venue_lecture: item.venue_lecture,
                venue_social: item.venue_social,
                rank_id: item.rank_id || null,
                group: item.group || null
            }));

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email_template: emailTemplate,
                    email_template_general: emailTemplateGeneral,
                    email_template_free: emailTemplateFree,
                    email_template_free_online: emailTemplateFreeOnline,
                    email_template_resend: emailTemplateResend,
                    email_template_forgot_pass: emailTemplateForgotPass,
                    email_template_multiple: emailTemplateMultiple,
                    email_template_reminder_venue_paid: emailTemplateReminderVenuePaid,
                    email_template_reminder_venue_unpaid: emailTemplateReminderVenueUnpaid,
                    email_template_reminder_online_paid: emailTemplateReminderOnlinePaid,
                    email_template_reminder_online_unpaid: emailTemplateReminderOnlineUnpaid,
                    online_viewing_links: onlineViewingLinks,
                    zoom_ids: zoomIds,
                    zoom_passes: zoomPasses,
                    lecture_dates: lectureDates,
                    lecture_end_dates: lectureEndDates,
                    admin_email: adminEmail,
                    admin_bcc_email: adminBccEmail,
                    test_email: testEmail,
                    // application_active: applicationActive // Moved to Global Settings
                })
            });

            if (res.ok) {
                alert('設定を保存しました');
                // setShowSettingsModal(false); // 続けて編集できるように閉じない
            } else {
                alert('保存失敗');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const markAsPaid = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`${selectedIds.size}件を「決済済」にしますか？`)) return;
        updateStatusBatch(Array.from(selectedIds), 'paid');
    };

    const markAsUnpaid = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`${selectedIds.size}件を「未決済」に戻しますか？`)) return;
        updateStatusBatch(Array.from(selectedIds), 'unpaid');
    };

    const duplicateSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`選択した${selectedIds.size}件を複製して新しく追加しますか？\n（決済ステータスは「未決済」にリセットされます）`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message || '複製しました');
                setSelectedIds(new Set()); // 選択解除
                fetchApplications(); // データ再取得
            } else {
                alert(`複製に失敗しました: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('エラーが発生しました');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`選択した${selectedIds.size}件のデータを削除しますか？\n（復元できません）`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });

            if (res.ok) {
                alert('削除しました');
                setSelectedIds(new Set());
                fetchApplications();
            } else {
                alert('削除に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const updateStatusBatch = async (ids: string[], status: string) => {
        try {
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, status }),
            });
            if (res.ok) {
                alert('更新しました');
                setSelectedIds(new Set());
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    // 重複検出ロジック
    const nameCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        apps.forEach(app => {
            const n = (app.input_name || '').trim();
            counts[n] = (counts[n] || 0) + 1;
        });
        return counts;
    }, [apps]);

    const confirmDuplicate = async (id: string) => {
        // 確認モーダルを表示
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id], is_duplicate_confirmed: true }),
            });
            if (res.ok) {
                alert('確認済みにしました');
                setShowDuplicateModal(false);
                fetchApplications(); // 再取得
            } else {
                alert('エラーが発生しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    // タグ削除機能（管理者が発行済みフラグを消す）
    const handleRemoveTag = async (appId: string, currentTags: string[], tagToRemove: string, label: string) => {
        if (!confirm(`この応募データの「${label}」を解除しますか？\n（解除すると再度お客様側から発行できるようになります）`)) return;

        try {
            const newTags = currentTags.filter(t => t !== tagToRemove);
            
            // mark APIを再利用して上書き
            const res = await fetch('/api/receipt/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: appId,
                    type: 'receipt_issued', // ダミー（tagMapで判定されるが今回はtags配列で上書きするため影響小）
                    tags: newTags,
                    is_admin: true
                })
            });

            if (res.ok) {
                // ローカルのステートを更新してUIを即座に反映
                setApps(apps.map(a => a.id === appId ? { ...a, tags: newTags } : a));
                alert('解除しました');
            } else {
                const data = await res.json();
                alert(`エラーが発生しました: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('本当にキャンセル処理しますか？')) return;
        try {
            const res = await fetch('/api/admin/applications/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, type: 'cancel' }),
            });
            if (res.ok) {
                alert('キャンセルしました');
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleUncancel = async (id: string) => {
        if (!confirm('キャンセルを解除して「未決済」に戻しますか？')) return;
        try {
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id], status: 'unpaid' }),
            });
            if (res.ok) {
                alert('キャンセルを解除しました');
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleResend = async (id: string) => {
        if (!confirm('再送メールの作成画面を開きますか？')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/email_preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                const data = await res.json();
                setCustomResendModal({
                    isOpen: true,
                    appId: id,
                    subject: data.subject,
                    body: data.content,
                    email: data.email
                });
            } else {
                alert('プレビューの取得に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const submitCustomResend = async () => {
        if (!customResendModal.appId) return;
        if (!confirm('この内容で再送しますか？（取り消せません）')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: customResendModal.appId,
                    subject: customResendModal.subject,
                    body: customResendModal.body
                })
            });

            if (res.ok) {
                alert('再送しました');
                setCustomResendModal({ ...customResendModal, isOpen: false });
            } else {
                alert('送信に失敗しました');
            }
        } catch (e) {
            alert('通信エラー');
        } finally {
            setLoading(false);
        }
    };

    // 重複アクションモーダルの状態
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateTargetApp, setDuplicateTargetApp] = useState<Application | null>(null);

    const handleDuplicateClick = (app: Application) => {
        setDuplicateTargetApp(app);
        setShowDuplicateModal(true);
    };

    const revertDuplicateStatus = async () => {
        if (!duplicateTargetApp) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [duplicateTargetApp.id], is_duplicate_confirmed: false }),
            });
            if (res.ok) {
                alert('「要確認」に戻しました');
                setShowDuplicateModal(false);
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const ignoreDuplicate = async () => {
        if (!duplicateTargetApp) return;
        setLoading(true);
        try {
            // 'ignore_duplicate' をタグに追加
            const currentTags = duplicateTargetApp.tags || [];
            if (currentTags.includes('ignore_duplicate')) {
                setShowDuplicateModal(false);
                return;
            }
            const newTags = [...currentTags, 'ignore_duplicate'];

            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: [duplicateTargetApp.id],
                    tags: newTags
                }),
            });
            if (res.ok) {
                alert('ラベルを非表示にしました');
                setShowDuplicateModal(false);
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const confirmProductAlert = async (id: string, currentTags: string[] = []) => {
        if (!confirm('このデータの「商品マスタ」警告を解除してよろしいですか？\n（通常表示に戻ります）')) return;
        setLoading(true);
        try {
            const newTags = [...currentTags, 'confirmed_product_alert'];
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: [id],
                    tags: newTags
                }),
            });
            if (res.ok) {
                alert('警告を解除しました');
                fetchApplications();
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewEmail = async (id: string) => {
        try {
            const res = await fetch('/api/admin/email_preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                const data = await res.json();
                setEmailPreview(data);
                setShowEmailModal(true);
            } else {
                alert('プレビュー取得失敗');
            }
        } catch (e) {
            alert('エラー');
        }
    };

    const openEditModal = (app: Application) => {
        setEditingApp(app);
        setEditForm({
            input_name: app.input_name,
            input_furigana: app.members?.furigana || app.input_furigana, // Pre-fill with best available
            input_email: app.input_email,
            total_amount: app.total_amount,
            social_venue: app.social_venue || 'none',
            venue: app.venue,
            applied_rank_name: app.applied_rank_name || app.members?.ranks?.name || '',
            remarks: app.remarks || '',
            payment_key: app.payment_key,
            member_generation: app.members?.generation,
            cc_email: app.cc_email || adminEmail || '',
            bcc_email: app.bcc_email || adminBccEmail || '',
            participation_type: app.participation_type,
            payment_status: app.payment_status
        });
        setShowModal(true);
    };

    // Key解析 ('【Rank】Venue/Social') からフィールドを抽出するヘルパー
    const parseKey = (key: string) => {
        // 新フォーマット: 【属性】会場 / 懇親会
        const newMatch = key.match(/^【(.+?)】(.+?) \/ (.+)$/);
        if (newMatch) {
            return { rank: newMatch[1], venue: newMatch[2], social: newMatch[3] };
        }
        // 旧フォーマット対応 (もしあれば)
        const oldMatch = key.match(/^【(.+)】【(.+)】\/(.+)$/);
        if (oldMatch) {
            return { rank: oldMatch[1], venue: oldMatch[2], social: oldMatch[3] };
        }
        return null;
    };

    // フィールド変更時の連動ロジック
    const handleFieldChange = (field: string, value: any) => {
        setEditForm(prev => {
            const next = { ...prev, [field]: value };
            
            // 属性・会場が変更された場合は金額と商品キーを再計算
            if (field === 'applied_rank_name' || field === 'venue' || field === 'social_venue' || field === 'participation_type' || field === 'online_venues') {
                const rankName = next.applied_rank_name || '一般';
                const venue = next.venue || '';
                const social = next.social_venue || 'none';
                
                const appRankId = ranks.find(r => r.name === rankName)?.id;
                const matchData = {
                    venue: venue,
                    social_venue: social,
                    participation_type: next.participation_type || 'venue',
                    online_venues: next.online_venues,
                    rank_id: appRankId ? String(appRankId) : null
                };
                const matchedProduct = matchProduct(paymentLinksData, matchData);
                
                if (matchedProduct) {
                    next.payment_key = matchedProduct.name;
                    // 商品マスタから金額を取得
                    const lectureFee = Number(matchedProduct.lecture_fee) || 0;
                    const socialFee = Number(matchedProduct.social_fee) || 0;
                    next.total_amount = lectureFee + socialFee;
                } else {
                    next.payment_key = ''; // reset if not found explicitly
                    // マッチしない場合は金額をリセットせず、手動入力を活かす（または0にするか検討が必要だが、現状は自動計算を試みる）
                }

                // オンライン判定の自動更新（会場名にキーワードが含まれる場合）
                if (field === 'venue') {
                    const isOnline = venue.includes('LIVE') || venue.includes('ライブ') || 
                                    venue.includes('オンライン') || venue.includes('アーカイブ');
                    if (isOnline) {
                        next.participation_type = 'online';
                    } else if (venue && venue !== '参加しない') {
                        next.participation_type = 'venue';
                    }
                }

                // 参加形式が明示的に変更された場合、不整合を防ぐためデフォルト値に調整
                if (field === 'participation_type') {
                    if (value === 'online' && !next.venue?.includes('LIVE') && !next.venue?.includes('オンライン') && !next.venue?.includes('アーカイブ')) {
                        next.venue = 'LIVE視聴';
                    } else if (value === 'venue' && (next.venue?.includes('LIVE') || next.venue?.includes('オンライン') || next.venue?.includes('アーカイブ'))) {
                        next.venue = '';
                    }
                    
                    // 金額の再計算のため、再マッチングを試みる
                    const updatedMatchData = {
                        ...matchData,
                        participation_type: value,
                        venue: next.venue
                    };
                    const reMatchedProduct = matchProduct(paymentLinksData, updatedMatchData);
                    if (reMatchedProduct) {
                        next.payment_key = reMatchedProduct.name;
                        const lectureFee = Number(reMatchedProduct.lecture_fee) || 0;
                        const socialFee = Number(reMatchedProduct.social_fee) || 0;
                        next.total_amount = lectureFee + socialFee;
                    }
                }
            }
            return next;
        });
    };

    // 新規登録用のフィールド変更連動ロジック
    const handleCreateFieldChange = (field: string, value: any) => {
        setCreateForm(prev => {
            const next = { ...prev, [field]: value };

            if (field === 'applied_rank_name' || field === 'venue' || field === 'social_venue' || field === 'participation_type' || field === 'online_venues') {
                const rankName = next.applied_rank_name || '一般';
                const venue = next.venue || '';
                const social = next.social_venue || 'none';
                
                const appRankId = ranks.find(r => r.name === rankName)?.id;
                const matchData = {
                    venue: venue,
                    social_venue: social,
                    participation_type: next.participation_type || 'venue',
                    online_venues: next.online_venues,
                    rank_id: appRankId ? String(appRankId) : null
                };
                const matchedProduct = matchProduct(paymentLinksData, matchData);
                
                if (matchedProduct) {
                    // 金額を自動適用
                    const lectureFee = Number(matchedProduct.lecture_fee) || 0;
                    const socialFee = Number(matchedProduct.social_fee) || 0;
                    next.total_amount = lectureFee + socialFee;
                    // 備考に商品名をメモとして残す（任意）
                    // next.remarks = (next.remarks || '') + ` [自動適用: ${matchedProduct.name}]`;
                }

                // オンライン判定の自動連動
                if (field === 'venue') {
                    const isOnline = venue.includes('LIVE') || venue.includes('ライブ') || 
                                    venue.includes('オンライン') || venue.includes('アーカイブ');
                    if (isOnline) {
                        next.participation_type = 'online';
                    } else if (venue && venue !== '参加しない') {
                        next.participation_type = 'venue';
                    }
                }

                // 参加形式が明示的に変更された場合、不整合を防ぐためデフォルト値に調整
                if (field === 'participation_type') {
                    if (value === 'online' && !next.venue?.includes('LIVE') && !next.venue?.includes('オンライン') && !next.venue?.includes('アーカイブ')) {
                        next.venue = 'LIVE視聴';
                    } else if (value === 'venue' && (next.venue?.includes('LIVE') || next.venue?.includes('オンライン') || next.venue?.includes('アーカイブ'))) {
                        next.venue = '';
                    }
                    
                    const updatedMatchData = {
                        ...matchData,
                        participation_type: value,
                        venue: next.venue
                    };
                    const reMatchedProduct = matchProduct(paymentLinksData, updatedMatchData);
                    if (reMatchedProduct) {
                        const lectureFee = Number(reMatchedProduct.lecture_fee) || 0;
                        const socialFee = Number(reMatchedProduct.social_fee) || 0;
                        next.total_amount = lectureFee + socialFee;
                    }
                }
            }
            return next;
        });
    };

    const handleKeyChange = (key: string) => {
        // 商品マスタから直接検索 (名称一致)
        const product = paymentLinksData.find(p => p.name === key || p.key === key);
        
        if (product) {
            const rankName = ranks.find(r => String(r.id) === String(product.rank_id))?.name || '';
            const amount = (Number(product.lecture_fee) || 0) + (Number(product.social_fee) || 0);
            
            setEditForm(prev => ({
                ...prev,
                payment_key: key,
                applied_rank_name: rankName || prev.applied_rank_name,
                venue: product.venue_lecture || prev.venue,
                social_venue: product.venue_social || prev.social_venue,
                total_amount: amount,
                participation_type: (product.venue_lecture?.includes('LIVE') || product.venue_lecture?.includes('ライブ')) ? 'online' : 'venue'
            }));
        } else {
            // マスタにない場合はキーのみ更新
            setEditForm(prev => ({ ...prev, payment_key: key }));
        }
    };

    const submitEdit = async () => {
        if (!editingApp) return;
        try {
            const payload = {
                id: editingApp.id,
                type: 'update',
                input_name: editForm.input_name,
                input_furigana: editForm.input_furigana,
                input_email: editForm.input_email,
                total_amount: editForm.total_amount,
                applied_rank_name: editForm.applied_rank_name,
                venue: editForm.venue,
                social_venue: editForm.social_venue,
                remarks: editForm.remarks,
                member_generation: editForm.member_generation,
                payment_key: editForm.payment_key, // Include product name
                cc_email: editForm.cc_email,
                bcc_email: editForm.bcc_email,
                participation_type: editForm.participation_type,
                online_venues: editForm.online_venues,
                payment_status: editForm.payment_status
            };

            const res = await fetch('/api/admin/applications/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, updated_at: editingApp.updated_at }), // updated_atを追加
            });
            if (res.ok) {
                alert('更新しました');
                setShowModal(false);
                setEditingApp(null);
                fetchApplications(); // Reload to see changes
            } else if (res.status === 409) {
                alert('エラー: データが別の管理者によって更新されています。ページをリロードして最新のデータを表示します。');
                setShowModal(false);
                setEditingApp(null);
                fetchApplications();
            } else {
                const data = await res.json();
                alert(`更新に失敗しました: ${data.error || '不明なエラー'} ${data.details || ''}`);
            }
        } catch (e) {
            alert('エラーが発生しました');
            console.error(e);
        }
    };

    // 重複排除ロジック
    // 同一人物と思われるレコード（氏名、Email、商品、会場が一致）を名寄せする
    // 優先順位: 決済済 > 最新の更新
    const deduplicateApps = (sourceApps: Application[]) => {
        // 現在の要件：名寄せ（重複排除）を停止。それぞれの申込レコードを独立して管理可能にする。
        return sourceApps;
    };

    const exportCSV = (useFilter: boolean = true) => {
        // 全レコードを出力（名寄せしない：合計金額不整合回避のため）
        let targetApps = useFilter ? [...filteredApps] : [...apps];

        // ソート順定義
        const rankOrder: Record<string, number> = {
            '特進コース': 1,
            'リピーター': 2,
            '初年度': 3,
            '経営幹部コース': 4,
            'ゲスト': 5
        };
        const getRankOrder = (r: string) => rankOrder[r] || 99;

        // ソートロジック
        targetApps.sort((a, b) => {
            const rankA = a.applied_rank_name || a.members?.ranks?.name || 'ゲスト';
            const rankB = b.applied_rank_name || b.members?.ranks?.name || 'ゲスト';
            const rDiff = getRankOrder(rankA) - getRankOrder(rankB);
            if (rDiff !== 0) return rDiff;

            const genA = a.members?.generation || 9999;
            const genB = b.members?.generation || 9999;
            const gDiff = genA - genB;
            if (gDiff !== 0) return gDiff;

            const furiA = a.members?.furigana || a.input_furigana || '';
            const furiB = b.members?.furigana || b.input_furigana || '';
            return furiA.localeCompare(furiB, 'ja');
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);

        const header = [
            'ID', '氏名', 'フリガナ', 'メールアドレス', '属性', '期', '特進', '会場', 'オンライン対象', '懇親会', '合計金額', '支払状況', '環境', '申込日時', '備考', 'タグ', '参加タイプ'
        ].join(',');

        const rows = targetApps.map(app => {
            const rank = app.applied_rank_name || app.members?.ranks?.name || '一般';
            const gen = app.members?.generation ? `${app.members.generation}期` : '-';
            const tokushin = app.members?.is_tokushin ? '特進' : '';
            const social = app.social_venue ? app.social_venue : (app.attend_social ? '参加' : '参加しない');
            // @ts-ignore
            const env = app.environment === 'production' ? '本番' : 'テスト';
            const remarks = (app.remarks || '').replace(/"/g, '""'); // Escape quotes for CSV
            const tags = (app.tags || []).join(' ');

            return [
                app.id,
                `"${app.input_name}"`,
                `"${app.members?.furigana || app.input_furigana}"`,
                `"${app.input_email}"`,
                `"${rank}"`,
                `"${gen}"`,
                `"${tokushin}"`,
                `"${app.venue || ''}"`,
                `"${app.online_venues || ''}"`,
                `"${social}"`,
                app.total_amount,
                app.payment_status,
                `"${env}"`,
                `"${new Date(app.created_at).toLocaleString('ja-JP')}"`,
                `"${remarks}"`,
                `"${tags}"`,
                `"${app.participation_type === 'online' ? 'オンライン' : '会場'}"`
            ].join(',');
        });

        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([bom, csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filenamePrefix = useFilter ? `shingengaku_list_${filter}` : 'shingengaku_list_ALL';
        a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    // Full Excel Export deleted for re-implementation


    // Simple Excel Export using exceljs
    const handleSimpleExcelExport = async () => {
        const getMonthFromDate = (s?: string) => {
            if (!s) return null;
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : (d.getMonth() + 1).toString();
        };

        const formatDateForExcel = (startStr: string, endStr?: string) => {
            if (!startStr) return '';
            const start = new Date(startStr);
            if (isNaN(start.getTime())) return startStr;
            const day = start.getDate();
            const startHM = start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            if (endStr) {
                const end = new Date(endStr);
                if (!isNaN(end.getTime())) {
                    const endHM = end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    return `${day}日 ${startHM}〜${endHM}`;
                }
            }
            return `${day}日 ${startHM}〜`;
        };

        const dateT = lectureDates['tokyo'] || '';
        const dateF = lectureDates['fukuoka'] || '';
        const dateEndT = lectureEndDates['tokyo'] || '';
        const dateEndF = lectureEndDates['fukuoka'] || '';

        const labelT = formatDateForExcel(dateT, dateEndT);
        const labelF = formatDateForExcel(dateF, dateEndF);

        const monthStr = exportMonth || getMonthFromDate(dateT) || getMonthFromDate(dateF) || (new Date().getMonth() + 1).toString();

        if (!confirm(`【【簡易版】エクセルファイルを生成しますか？\n対象月: ${monthStr}月\n東京日程: ${labelT}\n福岡日程: ${labelF}\n(東京・福岡・オンラインの3列表示・A4縦・罫線あり・グループ分け・連番)`)) return;

        setLoading(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('参加者リスト', {
                pageSetup: {
                    paperSize: 9, // A4
                    orientation: 'portrait',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0 // auto
                }
            });

            // Helper: Find Master-defined group priority (1:Tokushin, 2:Terms, 3:Executive, 4:Referral)
            const getPriorityByMaster = (app: Application) => {
                const rankName = app.applied_rank_name || app.members?.ranks?.name || '';
                
                // 1. Tokushin check (Highest Priority)
                if (rankName.includes('特進') || (app.members?.is_tokushin)) return 1;

                // 2. Referral check for General (一般) or explicit referral keywords
                const vL = (app.venue || '').toLowerCase();
                const k = (app.payment_key || '').toLowerCase();
                const tags = app.tags || [];
                const remarks = app.remarks || '';
                const hasIntroducer = vL.includes('紹介') || vL.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介') || tags.includes('ご紹介') || rankName.includes('紹介') || rankName.includes('ご紹介') || (remarks.match(/紹介者:\s*([^\n]+)/) && !remarks.includes('紹介者: なし') && !remarks.includes('紹介者: 未入力'));

                // 「一般」の場合で紹介がある、または名前/商品自体が「紹介」の場合は 5 (水無月のご縁ｷｬﾝﾍﾟｰﾝ) とする
                if (hasIntroducer && (rankName.includes('一般') || rankName === '')) {
                    return 5;
                }
                if (rankName.includes('紹介') || rankName.includes('ご紹介')) {
                    return 5;
                }

                // 3. Rank Master Check
                const masterRank = (ranks as any[]).find(r => r.name === rankName);
                if (masterRank?.group) {
                    if (masterRank.group === 'tokushin') return 1;
                    if (masterRank.group === 'terms') return 2;
                    if (masterRank.group === 'general') return 3;
                    if (masterRank.group === 'executive') return 4;
                    if (masterRank.group === 'referral') return 5;
                }

                // 4. Product Master Check (by Payment Key)
                const masterProduct = paymentLinksData.find(p => p.key === app.payment_key);
                if (masterProduct?.group) {
                    if (masterProduct.group === 'tokushin') return 1;
                    if (masterProduct.group === 'terms') return 2;
                    if (masterProduct.group === 'general') return 3;
                    if (masterProduct.group === 'executive') return 4;
                    if (masterProduct.group === 'referral') return 5;
                }

                if (rankName.includes('一般')) return 3;
                if (rankName.includes('経営幹部')) return 4;

                return 2; // Default to Terms
            };

            // Data Preparation for rows
            const getMemberInfo = (app: Application) => {
                const nameKey = `${(app.input_name || '').replace(/[\s\u3000]+/g, '')}|${(app.input_email || '').toLowerCase().trim()}`;
                const personStatus = personStatusMap.get(nameKey);
                
                let name = app.input_name + 'さま';
                let introText = '';
                let hasIntroducer = false;
                
                // 紹介者の抽出 (備考から)
                const remarks = app.remarks || '';
                const introMatch = remarks.match(/紹介者:\s*([^\n]+)/);
                if (introMatch && !introMatch[1].includes('なし') && !introMatch[1].includes('未入力')) {
                    let introName = introMatch[1].trim();
                    if (!introName.includes('さま') && !introName.includes('様')) {
                        introName += 'さま';
                    } else if (introName.includes('様')) {
                        introName = introName.replace('様', 'さま');
                    }
                    introText = `(${introName}ご紹介)`;
                    hasIntroducer = true;
                }

                const rawGen = app.members?.generation;
                const gen = (rawGen !== undefined && rawGen !== null) ? Number(rawGen) : 99;
                const term = gen === 99 ? '' : `${gen}期`;
                const furigana = app.members?.furigana || app.input_furigana || '';
                
                // 集約ステータスを使用
                const isBoth = personStatus?.isBoth || false;
                const isHybrid = personStatus?.isHybrid || false;

                const priority = getPriorityByMaster(app);

                return { name, introText, term, furigana, isBoth, isHybrid, gen, priority, paymentStatus: app.payment_status, hasIntroducer };
            };

            const normalizeKana = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
            const sorterName = (a: any, b: any) => normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
            const sorterTerm = (a: any, b: any) => {
                const genA = Number(a.gen);
                const genB = Number(b.gen);
                if (genA !== genB) return genA - genB;
                return normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
            };

            // キャンセルされたデータは含まないようにする
            // 名寄せせず、全ての有効な申込みを走査（2カ所参加、ハイブリッド等を漏れなく抽出）
            const allValidApps = apps.filter(a => (a.payment_status || '').toLowerCase() !== 'cancelled');

            // Filter Lists based on Unified Status
            const rawTokyo = allValidApps.filter(a => {
                const status = getParticipationStatus(a, venueList);
                return status.venueArea === 'tokyo' || status.venueArea === 'both';
            }).map(getMemberInfo);

            const rawFukuoka = allValidApps.filter(a => {
                const status = getParticipationStatus(a, venueList);
                return status.venueArea === 'fukuoka' || status.venueArea === 'both';
            }).map(getMemberInfo);

            const rawOnlineTokyo = allValidApps.filter(a => {
                const status = getParticipationStatus(a, venueList);
                return status.onlineArea === 'tokyo' || status.onlineArea === 'both';
            }).map(getMemberInfo);

            const rawOnlineFukuoka = allValidApps.filter(a => {
                const status = getParticipationStatus(a, venueList);
                return status.onlineArea === 'fukuoka' || status.onlineArea === 'both';
            }).map(getMemberInfo);

            const rawOthers = allValidApps.filter(a => {
                const status = getParticipationStatus(a, venueList);
                const isTokyo = status.venueArea === 'tokyo' || status.venueArea === 'both';
                const isFukuoka = status.venueArea === 'fukuoka' || status.venueArea === 'both';
                const isOnlineT = status.onlineArea === 'tokyo' || status.onlineArea === 'both';
                const isOnlineF = status.onlineArea === 'fukuoka' || status.onlineArea === 'both';
                // どのカテゴリ（東京・福岡・オンライン東京・オンライン福岡）にも該当しない場合
                return !isTokyo && !isFukuoka && !isOnlineT && !isOnlineF;
            }).map(getMemberInfo);

            // Grouping Helper
            const groupList = (list: any[]) => {
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

            // Determine Venue Rendering Order by Date
            const parseDay = (s: string) => {
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

            // Columns (4 cols + spacers)
            const colWidths = [4, 14, 5, 5];
            const spacerWidth = 2;
            ws.columns = [
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] }, { width: colWidths[3] },
                { width: spacerWidth },
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] }, { width: colWidths[3] },
                { width: spacerWidth },
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] }, { width: colWidths[3] },
            ];

            // Headers
            const totalListedCount = rawTokyo.length + rawFukuoka.length + rawOnlineTokyo.length + rawOnlineFukuoka.length + rawOthers.length;
            ws.mergeCells('A1:N1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `神言学集中講座 ${monthStr}月 (名簿掲載数: ${totalListedCount}名)`;
            titleCell.font = { size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };
            titleCell.border = { bottom: { style: 'thick' } };

            // Counts Row
            ws.getRow(2).height = 40; 
            
            // Render Headers for Venues (Ordered)
            venueOrder.forEach(v => {
                const startCol = v.colOffset + 1;
                const endCol = v.colOffset + 4;
                const cellRef = ws.getRow(2).getCell(startCol);
                ws.mergeCells(2, startCol, 2, endCol);
                cellRef.value = `${v.title} ${monthStr}月${v.date}\n参加者: ${v.count}名`;
                cellRef.font = { bold: true };
                cellRef.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
                cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
            });

            ws.mergeCells('K2:N2');
            ws.getCell('K2').value = `オンライン配信\n申込者: ${rawOnlineTokyo.length + rawOnlineFukuoka.length}名`;
            ws.getCell('K2').font = { bold: true };
            ws.getCell('K2').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            ws.getCell('K2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

            // Render Block Helper
            const renderBlock = (startRow: number, colOffset: number, title: string, data: any[], startSeq: number) => {
                let currentRow = startRow;
                
                // Group Title
                const titleCellRef = ws.getRow(currentRow).getCell(colOffset + 1);
                ws.mergeCells(currentRow, colOffset + 1, currentRow, colOffset + 4);
                titleCellRef.value = title;
                titleCellRef.alignment = { vertical: 'middle', horizontal: 'center' };
                titleCellRef.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: title.includes('配信分') ? 'FFD9EAD3' : 'FFD3D3D3' } 
                };
                titleCellRef.font = { bold: true };
                titleCellRef.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                currentRow++;

                if (data.length === 0) return { nextRow: currentRow, nextSeq: startSeq };

                // Headers
                const hRow = ws.getRow(currentRow);
                const headers = ['No', '氏名', '期', '決済'];
                [0, 1, 2, 3].forEach(i => {
                    const c = hRow.getCell(colOffset + 1 + i);
                    c.value = headers[i];
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    c.alignment = { horizontal: 'center' };
                });
                currentRow++;

                // Data
                let currentSeq = startSeq;
                data.forEach((d, idx) => {
                    const statusLabels: Record<string, string> = { paid: '済み', unpaid: '未決済' };

                    if (d.hasIntroducer) {
                        const r1 = ws.getRow(currentRow);
                        const r2 = ws.getRow(currentRow + 1);

                        ws.mergeCells(currentRow, colOffset + 1, currentRow + 1, colOffset + 1);
                        ws.mergeCells(currentRow, colOffset + 3, currentRow + 1, colOffset + 3);
                        ws.mergeCells(currentRow, colOffset + 4, currentRow + 1, colOffset + 4);

                        const c1 = ws.getCell(currentRow, colOffset + 1);
                        const c2_1 = ws.getCell(currentRow, colOffset + 2);
                        const c2_2 = ws.getCell(currentRow + 1, colOffset + 2);
                        const c3 = ws.getCell(currentRow, colOffset + 3);
                        const c4 = ws.getCell(currentRow, colOffset + 4);

                        c1.value = currentSeq++;
                        c1.alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        c2_1.value = d.name;
                        c2_1.alignment = { vertical: 'bottom', wrapText: true };
                        
                        c2_2.value = d.introText;
                        c2_2.alignment = { vertical: 'top', wrapText: true };
                        
                        c3.value = d.term;
                        c3.alignment = { horizontal: 'center', vertical: 'middle' };
                        c4.value = statusLabels[d.paymentStatus] || '';
                        c4.alignment = { horizontal: 'center', vertical: 'middle' };

                        // Borders for merged cells
                        [c1, c3, c4].forEach(c => {
                            c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        });

                        // Borders for name cells (no border between them)
                        c2_1.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                        c2_2.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

                        // Highlight 'Both' matches or 'Hybrid'
                        if (d.isBoth) {
                            c2_1.font = { color: { argb: 'FFFF0000' } };
                            c2_2.font = { color: { argb: 'FFFF0000' }, size: 10 };
                        } else if (d.isHybrid) {
                            c2_1.font = { color: { argb: 'FF00B050' } };
                            c2_2.font = { color: { argb: 'FF00B050' }, size: 10 };
                        } else {
                            c2_2.font = { size: 10 };
                        }

                        // Ensure hidden cells in the merge block also have borders (improves compatibility with some viewers)
                        ws.getCell(currentRow + 1, colOffset + 1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        ws.getCell(currentRow + 1, colOffset + 3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        ws.getCell(currentRow + 1, colOffset + 4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                        currentRow += 2;
                    } else {
                        const r = ws.getRow(currentRow);
                        const c1 = r.getCell(colOffset + 1);
                        const c2 = r.getCell(colOffset + 2);
                        const c3 = r.getCell(colOffset + 3);
                        const c4 = r.getCell(colOffset + 4);

                        c1.value = currentSeq++;
                        c1.alignment = { horizontal: 'center', vertical: 'middle' };
                        c2.value = d.name;
                        c2.alignment = { wrapText: true, vertical: 'middle' };
                        c3.value = d.term;
                        c3.alignment = { horizontal: 'center', vertical: 'middle' };
                        c4.value = statusLabels[d.paymentStatus] || '';
                        c4.alignment = { horizontal: 'center', vertical: 'middle' };

                        [c1, c2, c3, c4].forEach(c => {
                            c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        });

                        if (d.isBoth) {
                            c2.font = { color: { argb: 'FFFF0000' } };
                        } else if (d.isHybrid) {
                            c2.font = { color: { argb: 'FF00B050' } };
                        }
                        currentRow++;
                    }
                });

                return { nextRow: currentRow, nextSeq: currentSeq };
            };

            const startRow = 4;
            let maxRow = 4;

            // Render Real Venues (Tokyo/Fukuoka in determined order)
            venueOrder.forEach(v => {
                let rV = startRow;
                let seqV = 1;
                let resV = renderBlock(rV, v.colOffset, '特進', v.groups.tokushin, seqV);
                rV = resV.nextRow; seqV = resV.nextSeq;

                resV = renderBlock(rV, v.colOffset, exportTermLabel || 'リピート＆本講座', v.groups.terms, seqV);
                rV = resV.nextRow; seqV = resV.nextSeq;

                resV = renderBlock(rV, v.colOffset, '一般 (未受講)', v.groups.general, seqV);
                rV = resV.nextRow; seqV = resV.nextSeq;

                resV = renderBlock(rV, v.colOffset, '経営幹部', v.groups.executive, seqV);
                rV = resV.nextRow; seqV = resV.nextSeq;

                resV = renderBlock(rV, v.colOffset, exportCampaignLabel || '水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介', v.groups.referral, seqV);
                rV = resV.nextRow;

                if (rV > maxRow) maxRow = rV;
            });

            // Online Render (Ordered sub-sections)
            let rO = startRow;
            let seqO = 1;

            onlineOrder.forEach((o, idx) => {
                // Header for sub-section
                let resO = renderBlock(rO, 10, o.title, [], 0);
                rO = resO.nextRow;
                
                if (o.list.length > 0) {
                    resO = renderBlock(rO, 10, '特進', o.groups.tokushin, seqO);
                    rO = resO.nextRow; seqO = resO.nextSeq;
                    resO = renderBlock(rO, 10, exportTermLabel || 'リピート＆本講座', o.groups.terms, seqO);
                    rO = resO.nextRow; seqO = resO.nextSeq;
                    resO = renderBlock(rO, 10, '一般 (未受講)', o.groups.general, seqO);
                    rO = resO.nextRow; seqO = resO.nextSeq;
                    resO = renderBlock(rO, 10, '経営幹部', o.groups.executive, seqO);
                    rO = resO.nextRow; seqO = resO.nextSeq;
                    resO = renderBlock(rO, 10, exportCampaignLabel || '水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介', o.groups.referral, seqO);
                    rO = resO.nextRow; seqO = resO.nextSeq;
                }
                if (idx === 0) rO++; // Spacer between Tokyo/Fukuoka in Online column
            });

            if (rO > maxRow) maxRow = rO;


            // どのカテゴリにも分類されなかった「その他/不明」があれば末尾に追加
            if (rawOthers.length > 0) {
                maxRow += 2; // 少し空ける
                const othersGroup = groupList(rawOthers);
                const resOthers = renderBlock(maxRow, 0, '⚠️ 判定不能（会場名を確認してください）', othersGroup.terms, 1);
                maxRow = resOthers.nextRow;
            }

            ws.getRow(1).height = 30;

            // Render Remarks if exists
            if (exportRemarks) {
                const remarksRow = maxRow + 2;
                ws.mergeCells(`A${remarksRow}:N${remarksRow}`);
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
            }

            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simple_participants_${monthStr}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();

        } catch (e) {
            console.error(e);
            alert('エクセル生成エラー');
        } finally {
            setLoading(false);
        }
    };

    // Full Excel Export
    const handleFullExcelExport = async () => {
        if (!confirm('【詳細版】エクセルファイルを生成しますか？\n(会場ごとのシート分割・全項目)')) return;

        setLoading(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const allValidApps = apps.filter(a => (a.payment_status || '').toLowerCase() !== 'cancelled');

            const createSheet = (sheetName: string, filterFn: (a: Application) => boolean) => {
                const ws = wb.addWorksheet(sheetName);
                ws.columns = [
                    { header: 'ID', key: 'id', width: 10 },
                    { header: '氏名', key: 'name', width: 20 },
                    { header: 'フリガナ', key: 'furigana', width: 20 },
                    { header: 'メール', key: 'email', width: 30 },
                    { header: '属性', key: 'rank', width: 10 },
                    { header: '期', key: 'gen', width: 8 },
                    { header: '特進', key: 'tokushin', width: 8 },
                    { header: '会場', key: 'venue', width: 15 },
                    { header: 'オンライン対象', key: 'online', width: 15 },
                    { header: '懇親会', key: 'social', width: 15 },
                    { header: '金額', key: 'amount', width: 10 },
                    { header: '支払', key: 'payment', width: 10 },
                    { header: '申込日時', key: 'created', width: 20 },
                    { header: '備考', key: 'remarks', width: 30 },
                    { header: '商品名', key: 'product', width: 30 }
                ];

                // Style Header
                ws.getRow(1).font = { bold: true };
                ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

                const data = allValidApps.filter(filterFn).map(app => {
                    const rank = app.applied_rank_name || app.members?.ranks?.name || '一般';
                    const gen = app.members?.generation ? `${app.members.generation}期` : '-';
                    const tokushin = app.members?.is_tokushin ? '特進' : '';
                    const social = app.social_venue ? app.social_venue : (app.attend_social ? '参加' : '参加しない');

                    return {
                        id: app.id,
                        name: app.input_name,
                        furigana: app.members?.furigana || app.input_furigana,
                        email: app.input_email,
                        rank,
                        gen,
                        tokushin,
                        venue: app.venue || '',
                        online: app.online_venues || '',
                        social,
                        amount: app.total_amount,
                        payment: app.payment_status,
                        created: new Date(app.created_at).toLocaleString('ja-JP'),
                        remarks: app.remarks || '',
                        product: app.payment_key || ''
                    };
                });

                data.forEach(d => ws.addRow(d));
            };

            createSheet('全データ', () => true);
            createSheet('東京会場', a => {
                const status = getParticipationStatus(a, venueList);
                return status.venueArea === 'tokyo' || status.venueArea === 'both';
            });
            createSheet('福岡会場', a => {
                const status = getParticipationStatus(a, venueList);
                return status.venueArea === 'fukuoka' || status.venueArea === 'both';
            });
            createSheet('オンライン（東京）', a => {
                const status = getParticipationStatus(a, venueList);
                return status.onlineArea === 'tokyo' || status.onlineArea === 'both';
            });
            createSheet('オンライン（福岡）', a => {
                const status = getParticipationStatus(a, venueList);
                return status.onlineArea === 'fukuoka' || status.onlineArea === 'both';
            });

            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();

        } catch (e) {
            console.error(e);
            alert('エクセル生成エラー');
        } finally {
            setLoading(false);
        }
    };

    const handleTruncate = async (e: React.MouseEvent) => {
        // Ctrlキーが押されていない場合は無視
        if (!e.ctrlKey) {
            alert('一括削除を実行するには、Ctrlキー（Macの場合はCommandキー/Ctrlキー）を押しながらクリックしてください。');
            return;
        }

        if (!confirm('【最重要・危険】全ての申込データを削除しますか？\n（復元できません。本当に実行する場合のみOKを押してください）')) return;
        
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/truncate', { method: 'POST' });
            if (res.ok) {
                alert('全データを削除しました');
                fetchApplications();
            } else {
                const data = await res.json();
                alert(`削除に失敗しました: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('エラー');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateApp = async () => {
        if (!createForm.input_name || !createForm.venue) {
            alert('氏名と講義会場は必須です');
            return;
        }
        if (!confirm('この内容で手動登録しますか？\n（※自動受付メールは送信されません）')) return;

        setCreating(true);
        try {
            const res = await fetch('/api/admin/applications/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            });

            if (res.ok) {
                alert('登録しました');
                setShowCreateModal(false);
                setCreateForm({});
                fetchApplications();
            } else {
                const data = await res.json();
                alert(`登録に失敗しました: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteApp = async (id: string) => {
        if (!confirm('このデータを削除しますか？\n（復元できません）')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                alert('削除しました');
                fetchApplications();
            } else {
                alert('削除失敗');
            }
        } catch (e) {
            alert('エラー');
        } finally {
            setLoading(false);
        }
    };

    const handleSendReminders = () => {
        setShowReminderModal(true);
    };

    const submitReminders = async () => {
        if (!confirm('選択した参加者にリマインドメールを一括送信しますか？')) return;
        
        // 送信対象を絞り込む（キャンセル済みを除外）
        const targetIds = Array.from(selectedIds).filter(id => {
            const app = apps.find(a => a.id === id);
            return app && app.payment_status !== 'cancelled';
        });

        if (targetIds.length === 0) {
            alert('送信対象となる（キャンセルされていない）データがありません。');
            return;
        }

        setReminderSending(true);
        try {
            const res = await fetch('/api/admin/reminders/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: targetIds })
            });

            if (res.ok) {
                alert('送信を開始しました。一括処理のため完了まで数分かかる場合があります。送信済みのデータには「reminder_sent」タグが付与されます。');
                setShowReminderModal(false);
                setSelectedIds(new Set());
                fetchApplications();
            } else {
                const data = await res.json();
                alert(`送信エラー: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('送信エラーが発生しました');
        } finally {
            setReminderSending(false);
        }
    };

    const reminderSummary = useMemo(() => {
        const selectedApps = apps.filter(a => selectedIds.has(a.id));
        const summary = {
            tokyo_venue: 0,
            fukuoka_venue: 0,
            tokyo_online: 0,
            fukuoka_online: 0,
            paid: 0,
            unpaid: 0,
            cancelled: 0
        };

        selectedApps.forEach(app => {
            if (app.payment_status === 'cancelled') {
                summary.cancelled++;
                return;
            }

            const normVenue = normalizeVenue(app.venue);
            if (normVenue === '参加しない') return;

            const status = getParticipationStatus(app, venueList);
            const isOnline = app.participation_type === 'online' || isOnlineVenue(app.venue || '') || isOnlineVenue(app.online_venues || '');
            const isAlert = app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert');
            const isPaidOrFree = app.payment_status === 'paid' || (app.total_amount === 0 && app.payment_status !== 'cancelled' && !isAlert);
            
            if (isPaidOrFree) summary.paid++; else summary.unpaid++;

            let area: 'tokyo' | 'fukuoka' | 'both' = 'tokyo';
            if (normVenue === '東京・福岡' || (app.online_venues || '').includes('東京・福岡')) {
                area = 'both';
            } else if (status.venueArea === 'fukuoka' || status.onlineArea === 'fukuoka') {
                area = 'fukuoka';
            } else if (app.venue?.includes('福岡') || app.online_venues?.includes('福岡')) {
                area = 'fukuoka';
            }

            if (isOnline) {
                if (area === 'both') {
                    summary.tokyo_online++;
                    summary.fukuoka_online++;
                } else if (area === 'fukuoka') {
                    summary.fukuoka_online++;
                } else {
                    summary.tokyo_online++;
                }
            } else {
                if (area === 'both') {
                    summary.tokyo_venue++;
                    summary.fukuoka_venue++;
                } else if (area === 'fukuoka') {
                    summary.fukuoka_venue++;
                } else {
                    summary.tokyo_venue++;
                }
            }
        });

        return summary;
    }, [selectedIds, apps, venueList]);
    const filteredApps = apps.filter(app => {
        // Status Filter
        if (filter !== 'all' && app.payment_status !== filter) return false;

        // Search Filter
        if (searchQuery) {
            const keywords = searchQuery.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const name = (app.input_name || '').toLowerCase();
            const furi = (app.members?.furigana || app.input_furigana || '').toLowerCase();
            const email = (app.input_email || '').toLowerCase();
            const product = (app.payment_key || '').toLowerCase();
            const venue = (app.venue || '').toLowerCase();
            const remarks = (app.remarks || '').toLowerCase();

            // AND Condition: All keywords must match at least one field
            return keywords.every(k =>
                name.includes(k) || furi.includes(k) || email.includes(k) || product.includes(k) || venue.includes(k) || remarks.includes(k)
            );
        }

        // Rank Filter (OR Logic within Filter)
        if (filterRank.size > 0) {
            const r = app.applied_rank_name || app.members?.ranks?.name || '一般';
            if (!filterRank.has(r)) return false;
        }

        // Generation Filter (OR Logic within Filter)
        if (filterGen.size > 0) {
            const g = app.members?.generation?.toString();
            // If generation is null/undefined, treat as... excluded if filter is set
            // What if generation does not exist?
            if (!g || !filterGen.has(g)) return false;
        }

        // Product Name Filter (OR Logic within Filter)
        if (filterProduct.size > 0) {
            if (!app.payment_key || !filterProduct.has(app.payment_key)) return false;
        }

        // Venue (Lecture) Filter
        if (filterVenueLecture.size > 0) {
            let v = app.venue || '';

            // 内部キー(tokyo等)が混在しているレガシーデータへの対応
            const venueMap: Record<string, string> = { 'tokyo': '東京', 'fukuoka': '福岡', 'both': '東京・福岡', 'none': 'none' };
            v = venueMap[v] || v;

            if (!filterVenueLecture.has(v)) {
                return false;
            }
        }

        // Venue (Social) Filter
        if (filterVenueSocial.size > 0) {
            let s = app.social_venue || 'none';
            const socialMap: Record<string, string> = { 'tokyo': '東京', 'fukuoka': '福岡', 'both': '東京・福岡', 'none': 'none' };
            s = socialMap[s] || s;

            if (!filterVenueSocial.has(s)) return false;
        }

        // Online Option Filter (Type)
        if (filterOnlineOption.size > 0) {
            const status = getParticipationStatus(app, venueList);
            if (!status.onlineArea) return false;
            const v = app.venue || '';
            if (!filterOnlineOption.has(v)) return false;
        }

        // Online Area Filter (Location)
        if (filterOnlineArea.size > 0) {
            const status = getParticipationStatus(app, venueList);
            if (!status.onlineArea) return false;
            if (status.onlineArea === 'both') {
                // If the user has both, and we selected either Tokyo or Fukuoka, it should match
                if (!filterOnlineArea.has('tokyo') && !filterOnlineArea.has('fukuoka') && !filterOnlineArea.has('both')) return false;
            } else if (!filterOnlineArea.has(status.onlineArea)) {
                return false;
            }
        }

        return true;
    });

    // ソート処理
    const sortedApps = useMemo(() => {
        let sortableApps = [...filteredApps];
        if (sortConfig !== null) {
            sortableApps.sort((a, b) => {
                let aValue: any = '';
                let bValue: any = '';

                switch (sortConfig.key) {
                    case 'created_at':
                        aValue = new Date(a.created_at).getTime();
                        bValue = new Date(b.created_at).getTime();
                        break;
                    case 'payment_status':
                        // ステータスの優先度定義 (未決済 > 決済済 > キャンセル)
                        const statusOrder: Record<string, number> = { 'unpaid': 1, 'paid': 2, 'cancelled': 3 };
                        aValue = statusOrder[a.payment_status] || 99;
                        bValue = statusOrder[b.payment_status] || 99;
                        break;
                    case 'name':
                        aValue = a.members?.furigana || a.input_furigana || '';
                        bValue = b.members?.furigana || b.input_furigana || '';
                        break;
                    case 'rank':
                        // ランクのソート順(特進 > リピーター > 初年度 > 幹部 > ゲスト)
                        const rankOrder: Record<string, number> = {
                            '特進コース': 1, 'リピーター': 2, '初年度': 3, '経営幹部コース': 4, 'ゲスト': 5
                        };
                        const rNameA = a.applied_rank_name || a.members?.ranks?.name || 'ゲスト';
                        const rNameB = b.applied_rank_name || b.members?.ranks?.name || 'ゲスト';
                        aValue = rankOrder[rNameA] || 99;
                        bValue = rankOrder[rNameB] || 99;
                        break;
                    case 'generation':
                        aValue = a.members?.generation || 9999;
                        bValue = b.members?.generation || 9999;
                        break;
                    case 'total_amount':
                        aValue = a.total_amount;
                        bValue = b.total_amount;
                        break;
                    default:
                        // デフォルトで文字列比較
                        aValue = (a as any)[sortConfig.key];
                        bValue = (b as any)[sortConfig.key];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableApps;
    }, [filteredApps, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name: string) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <span className='text-gray-300 ml-1'></span>;
        }
        return <span className="text-indigo-600 ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    // Options for Filters
    const rankOptions = ranks.map(r => ({ label: r.name, value: r.name }));

    // Term Options
    // Union of master and actual data
    const termOptionsRaw = termMaster.length > 0 ? termMaster : Array.from(new Set(apps.map(a => a.members?.generation).filter(Boolean))).sort((a, b) => a! - b!);
    const termOptions = termOptionsRaw.map(g => ({ label: `${g}期`, value: String(g) }));

    // Product Options
    // Union of master and actual data
    const masterNames = paymentLinksData.map(p => p.name).filter(Boolean);
    const prodOptionsRaw = Array.from(new Set([...masterNames, ...apps.map(a => a.payment_key).filter(Boolean)])).sort();
    const prodOptions = prodOptionsRaw.map(k => ({ label: k as string, value: k as string }));

    const venueLectureOptions = [
        ...Array.from(new Set([...venueList.filter(v => v.type === 'lecture').map(v => v.name)])).map(v => ({ label: v as string, value: v as string })),
        { label: '東京・福岡', value: '東京・福岡' },
        { label: '参加しない', value: 'none' }
    ];
    // Remove duplicates by value just in case
    const uniqueVenueLectureOptions = Array.from(new Map(venueLectureOptions.map(item => [item.value, item])).values());

    const venueSocialOptions = [
        ...Array.from(new Set([...venueList.filter(v => v.type === 'social').map(v => v.name)])).map(v => ({ label: v as string, value: v as string })),
        { label: '東京・福岡', value: '東京・福岡' },
        { label: '参加しない', value: 'none' }
    ];
    const uniqueVenueSocialOptions = Array.from(new Map(venueSocialOptions.map(item => [item.value, item])).values());

    const uniqueOnlineOptions = onlineOptionMaster.map(o => ({ label: o.name, value: o.name }));
    const onlineAreaOptions = [
        { label: '東京配信分', value: 'tokyo' },
        { label: '福岡配信分', value: 'fukuoka' }
    ];


    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-2">
                    <h1 className='text-2xl font-bold text-gray-800'>神言学 管理ダッシュボード</h1>
                    <div className="flex items-center space-x-2 ml-auto">
                        <div className="flex space-x-2 mr-4 border-r pr-4 border-gray-300">
                            <Link href="/admin/members" className="text-sm px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">受講生マスタ</Link>
                            <Link href="/admin/ranks" className="text-sm px-3 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">属性マスタ</Link>
                            <Link href='/admin/products' className='text-sm px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100'>商品マスタ</Link>
                            <Link href="/admin/venues" className="text-sm px-3 py-1 bg-pink-50 text-pink-700 rounded hover:bg-pink-100">会場マスタ</Link>
                            <Link href="/admin/online-options" className="text-sm px-3 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">オンライン</Link>
                            <Link href='/admin/terms' className='text-sm px-3 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100'>期マスタ</Link>
                            <Link href='/admin/settings' className='text-sm px-3 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100'>全体設定</Link>
                            <Link href='/admin/users' className='text-sm px-3 py-1 bg-white border text-gray-700 rounded hover:bg-gray-50'>管理者管理</Link>
                        </div>
                        <button onClick={fetchApplications} className="text-sm text-blue-600 hover:underline">再読込</button>
                        <button onClick={() => fetchSettings(true)} className="text-sm text-gray-600 hover:text-gray-900 border px-3 py-1 rounded">設定変更</button>
                        <button onClick={handleLogout} className='text-sm text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1 rounded ml-2'>ログアウト</button>
                    </div>
                </div>

                {/* コントロールバー */}
                <div className="bg-white p-3 rounded-lg shadow mb-2 space-y-2">
                    <div className="flex flex-wrap gap-2 justify-between items-center">
                        <div className="flex gap-2 items-center">
                            <button onClick={() => setFilter('unpaid')} className={`px-4 py-2 rounded-md ${filter === 'unpaid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>未決済</button>
                            <button onClick={() => setFilter('paid')} className={`px-4 py-2 rounded-md ${filter === 'paid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>決済済</button>
                            <button onClick={() => setFilter('cancelled')} className={`px-4 py-2 rounded-md ${filter === 'cancelled' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>キャンセル</button>
                            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>全て</button>
                            <div className="w-px bg-gray-300 h-8 mx-2"></div>
                            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-md bg-green-600 text-white font-bold hover:bg-green-700">新規登録</button>
                            <button onClick={fetchUnappliedMembers} className="px-4 py-2 rounded-md bg-yellow-500 text-white font-bold hover:bg-yellow-600 ml-2">未申込者を確認</button>
                            <span className="ml-4 text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">System Logic v2.1</span>
                        </div>
                        {/* 統計表示 */}
                        <div className="flex gap-4 text-sm bg-gray-50 px-4 py-2 rounded border border-gray-200">
                            <div className="flex flex-col items-center">
                                <span className="text-indigo-600 text-[10px] font-bold">有効申込数</span>
                                <span className="font-bold text-gray-800 text-lg leading-tight">{apps.filter(a => a.payment_status !== 'cancelled').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className='text-gray-500 text-xs'>未決済</span>
                                <span className="font-bold text-red-600">{apps.filter(a => a.payment_status === 'unpaid').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className='text-gray-500 text-xs'>決済済</span>
                                <span className="font-bold text-green-600">{apps.filter(a => a.payment_status === 'paid').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-2"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">キャンセル</span>
                                <span className="font-bold text-gray-600">{apps.filter(a => a.payment_status === 'cancelled').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-[10px]">全体件数</span>
                                <span className="font-bold text-gray-500">{apps.length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className='text-gray-500 text-xs'>表示中</span>
                                <span className="font-bold text-indigo-600">{filteredApps.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* 高度なフィルター (属性選択) */}
                    <div className="flex gap-2 items-start">
                        <MultiSelect
                            label="全ての属性"
                            options={rankOptions}
                            selected={filterRank}
                            onChange={setFilterRank}
                            width="w-40"
                        />
                        <MultiSelect
                            label='全ての期'
                            options={termOptions}
                            selected={filterGen}
                            onChange={setFilterGen}
                            width="w-32"
                        />
                        <MultiSelect
                            label='全ての商品名'
                            options={prodOptions}
                            selected={filterProduct}
                            onChange={setFilterProduct}
                            width="w-80" // Widened from default / approximate 200px
                        />
                    </div>

                    <div className="flex gap-2 items-start">
                        <MultiSelect
                            label="全ての講義会場"
                            options={uniqueVenueLectureOptions}
                            selected={filterVenueLecture}
                            onChange={setFilterVenueLecture}
                            width="w-40"
                        />
                        <MultiSelect
                            label="全ての懇親会の回答"
                            options={uniqueVenueSocialOptions}
                            selected={filterVenueSocial}
                            onChange={setFilterVenueSocial}
                            width="w-40"
                        />
                        <MultiSelect
                            label='全ての視聴タイプ'
                            options={uniqueOnlineOptions}
                            selected={filterOnlineOption}
                            onChange={setFilterOnlineOption}
                            width="w-48"
                        />
                        <MultiSelect
                            label='全ての配信拠点'
                            options={onlineAreaOptions}
                            selected={filterOnlineArea}
                            onChange={setFilterOnlineArea}
                            width="w-40"
                        />
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* 検索ボックス */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder='名前フリガナEmailで検索 (スペース区切り)'
                                className="border rounded px-3 py-2 text-sm w-80"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                ></button>
                            )}
                        </div>

                        <div className="flex flex-col gap-1 items-end ml-4 border-l pl-4 border-gray-300">
                            <div className="flex gap-2 mb-1 justify-end items-center">
                                <span className="text-xs font-bold text-gray-500">出力設定:</span>
                                <input
                                    type="text"
                                    placeholder="月"
                                    className="border rounded px-2 py-1 text-sm w-12 text-center bg-white hover:border-indigo-400 transition-colors"
                                    value={exportMonth}
                                    onChange={(e) => setExportMonth(e.target.value)}
                                />
                                <span className="text-xs">月</span>
                            </div>
                            <div className="flex flex-col gap-1 mb-1 justify-end items-end">
                                <div className="flex gap-2 items-center">
                                    <span className="text-[10px] text-gray-500 font-bold w-6">東京</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            className="border rounded px-2 py-1 text-sm w-32 bg-white hover:border-indigo-400 transition-colors"
                                            value={(lectureDates['tokyo'] || '').split('T')[0]}
                                            onChange={(e) => {
                                                const time = (lectureDates['tokyo'] || '').split('T')[1] || '00:00';
                                                setLectureDates({...lectureDates, tokyo: `${e.target.value}T${time}`});
                                            }}
                                        />
                                        <DrumTimePicker 
                                            value={lectureDates['tokyo'] || ''}
                                            onChange={(val) => setLectureDates({...lectureDates, tokyo: val})}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400">〜</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            className="border rounded px-2 py-1 text-sm w-32 bg-white hover:border-indigo-400 transition-colors"
                                            value={(lectureEndDates['tokyo'] || '').split('T')[0]}
                                            onChange={(e) => {
                                                const time = (lectureEndDates['tokyo'] || '').split('T')[1] || '00:00';
                                                setLectureEndDates({...lectureEndDates, tokyo: `${e.target.value}T${time}`});
                                            }}
                                        />
                                        <DrumTimePicker 
                                            value={lectureEndDates['tokyo'] || ''}
                                            onChange={(val) => setLectureEndDates({...lectureEndDates, tokyo: val})}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="text-[10px] text-gray-500 font-bold w-6">福岡</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            className="border rounded px-2 py-1 text-sm w-32 bg-white hover:border-indigo-400 transition-colors"
                                            value={(lectureDates['fukuoka'] || '').split('T')[0]}
                                            onChange={(e) => {
                                                const time = (lectureDates['fukuoka'] || '').split('T')[1] || '00:00';
                                                setLectureDates({...lectureDates, fukuoka: `${e.target.value}T${time}`});
                                            }}
                                        />
                                        <DrumTimePicker 
                                            value={lectureDates['fukuoka'] || ''}
                                            onChange={(val) => setLectureDates({...lectureDates, fukuoka: val})}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400">〜</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            className="border rounded px-2 py-1 text-sm w-32 bg-white hover:border-indigo-400 transition-colors"
                                            value={(lectureEndDates['fukuoka'] || '').split('T')[0]}
                                            onChange={(e) => {
                                                const time = (lectureEndDates['fukuoka'] || '').split('T')[1] || '00:00';
                                                setLectureEndDates({...lectureEndDates, fukuoka: `${e.target.value}T${time}`});
                                            }}
                                        />
                                        <DrumTimePicker 
                                            value={lectureEndDates['fukuoka'] || ''}
                                            onChange={(val) => setLectureEndDates({...lectureEndDates, fukuoka: val})}
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={saveSettings}
                                    className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100 mt-1 font-bold"
                                >
                                    設定を保存
                                </button>
                            </div>
                            <div className="flex gap-2 mb-2 justify-end items-center">
                                <span className="text-xs text-gray-500">期表記</span>
                                <input
                                    type="text"
                                    placeholder="リピート＆本講座"
                                    className="border rounded px-2 py-1 text-sm w-36 text-center bg-white hover:border-indigo-400 transition-colors"
                                    value={exportTermLabel}
                                    onChange={(e) => setExportTermLabel(e.target.value)}
                                />
                                <span className="text-xs text-gray-500 ml-2">紹介・ｷｬﾝﾍﾟｰﾝ表記</span>
                                <input
                                    type="text"
                                    placeholder="水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介"
                                    className="border rounded px-2 py-1 text-sm w-48 text-center bg-white hover:border-indigo-400 transition-colors"
                                    value={exportCampaignLabel}
                                    onChange={(e) => setExportCampaignLabel(e.target.value)}
                                />
                            </div>
                            <div className="w-full mb-2">
                                <textarea
                                    placeholder="エクセル用備考 (下部に表示されます)"
                                    className="border rounded px-2 py-1 text-xs w-full h-16 resize-none"
                                    value={exportRemarks}
                                    onChange={(e) => setExportRemarks(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 mt-1">
                                <button onClick={() => exportCSV(false)} className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs shadow-sm">全データCSV</button>
                                <button onClick={() => exportCSV(true)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs shadow-sm">表示中CSV</button>
                                <button onClick={handleSimpleExcelExport} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs shadow-sm">簡易エクセル(A4)</button>
                                <button disabled className="px-3 py-1 bg-gray-400 text-white rounded cursor-not-allowed text-xs shadow-sm">詳細エクセル</button>
                            </div>
                        </div>
                    </div>

                    {/* データリセットボタン (右端) */}
                    <div className="flex justify-end pt-2 border-t border-gray-100 mt-2">
                        <button onClick={(e) => handleTruncate(e)} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded hover:bg-red-50" title="【重要】Ctrlキー（MacはCommand）を押しながらクリックして、全ての申込データを一括削除します">
                            データをリセット(削除)
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm mb-2">
                    <div>
                        {selectedIds.size > 0 && (
                            <div className="flex gap-2">
                                <button onClick={markAsPaid} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                                    選択した{selectedIds.size} 件を「決済済」にする
                                </button>
                                <button onClick={markAsUnpaid} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                                    選択した{selectedIds.size} 件を「未決済」に戻す
                                </button>
                                <button onClick={duplicateSelected} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ml-4 shadow">
                                    選択した{selectedIds.size} 件を「複製」する
                                </button>
                                <button onClick={deleteSelected} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ml-4 shadow">
                                    選択した{selectedIds.size} 件を「削除」する
                                </button>
                                <button onClick={handleSendReminders} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ml-4 font-bold shadow-md flex items-center gap-2">
                                    <span>✉️</span>
                                    リマインド一括送信 ({selectedIds.size}件)
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={(e) => handleTruncate(e)} className="hidden" title="Moved to filter bar"></button>
                </div>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-140px)] relative border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                    <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10 sticky top-0 bg-gray-50 z-20 border-b">
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedIds(new Set(sortedApps.map(a => a.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={sortedApps.length > 0 && selectedIds.size === sortedApps.length}
                                />
                            </th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('created_at')}
                            >
                                申込日時{getSortIcon('created_at')}
                            </th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('payment_status')}
                            >
                                状態{getSortIcon('payment_status')}
                            </th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('name')}
                            >
                                名前 / Email {getSortIcon('name')}
                            </th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('rank')}
                            >
                                属性 / 備考{getSortIcon('rank')}
                            </th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('generation')}
                            >
                                期{getSortIcon('generation')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-20 border-b">会場 / オンライン / 懇親会</th>
                            <th
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky top-0 bg-gray-50 z-20 border-b"
                                onClick={() => requestSort('total_amount')}
                            >
                                金額 / 商品名{getSortIcon('total_amount')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-20 border-b">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={9} className="px-3 py-2 text-center">読み込み中...</td></tr>
                        ) : sortedApps.length === 0 ? (
                            <tr><td colSpan={9} className="px-3 py-2 text-center">データがありません</td></tr>
                        ) : (
                            sortedApps.map((app) => {
                                const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
                                const gen = app.members?.generation ? `${app.members.generation}期` : '';
                                const furigana = app.members?.furigana || app.input_furigana;

                                const isAlert = app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert');
                                // 除外されているか確認
                                const isIgnored = app.tags?.includes('ignore_duplicate');

                                // 商品名のマッチングロジック (venueUtilsの共通ロジックを使用)
                                const appRankId = ranks.find(r => r.name === rankName)?.id;
                                
                                const matchData = {
                                    venue: app.venue || '',
                                    social_venue: app.social_venue || '',
                                    participation_type: app.participation_type || 'venue',
                                    online_venues: app.online_venues,
                                    rank_id: appRankId ? String(appRankId) : null,
                                    payment_key: app.payment_key
                                };

                                const matchedProduct = matchProduct(paymentLinksData, matchData);
                                let displayProductName = '';

                                if (matchedProduct) {
                                    displayProductName = matchedProduct.name;
                                } else if (app.payment_key) {
                                    displayProductName = app.payment_key; // フォールバック
                                } else {
                                    // マッチせず、保存された名前もない場合のフォールバック表示名
                                    const vName = getVenueDisplayName(app.venue || '', app.participation_type || 'venue', app.online_venues);
                                    let sName = app.social_venue || '懇親会なし';
                                    if (sName === 'none' || sName === '参加しない') sName = '懇親会なし';
                                    else if (sName === 'ー') sName = '';
                                    else sName = '懇親会あり';

                                    displayProductName = `【${rankName}】${vName}${sName ? '/' + sName : ''}`;
                                }

                                return (
                                    <tr key={app.id} className={`${selectedIds.has(app.id) ? 'bg-indigo-50' : (isAlert ? 'bg-red-50' : '')} ${isAlert ? 'text-red-600' : ''}`}>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(app.id)}
                                                onChange={() => toggleSelect(app.id)}
                                                className="mt-1"
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 align-top">
                                            {new Date(app.created_at).toLocaleString('ja-JP')}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    app.payment_status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                                    (app.payment_status === 'paid' || (app.total_amount === 0 && !isAlert)) ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {app.payment_status === 'cancelled' ? 'キャンセル' :
                                                     (app.total_amount === 0 && !isAlert) ? '決済不要' :
                                                     app.payment_status === 'paid' ? '決済済' : '未決済'}
                                                </span>
                                                {/* @ts-ignore */}
                                                {app.environment === 'production' ? (
                                                    <span className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 border border-red-100 rounded">本番データ</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded">テストデータ</span>
                                                )}
                                                {app.tags?.includes('receipted') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'receipted', '領収書(合)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >領収書(合) 済</span>
                                                )}
                                                {app.tags?.includes('receipted_lecture') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'receipted_lecture', '領収(講)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >領収(講) 済</span>
                                                )}
                                                {app.tags?.includes('receipted_social') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'receipted_social', '領収(懇)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >領収(懇) 済</span>
                                                )}
                                                {app.tags?.includes('invoiced') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'invoiced', '請求書(合)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-sky-50 text-sky-600 border border-sky-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >請求書(合) 済</span>
                                                )}
                                                {app.tags?.includes('invoiced_lecture') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'invoiced_lecture', '請求(講)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-sky-50 text-sky-600 border border-sky-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >請求(講) 済</span>
                                                )}
                                                {app.tags?.includes('invoiced_social') && (
                                                    <span 
                                                        onClick={() => handleRemoveTag(app.id, app.tags || [], 'invoiced_social', '請求(懇)')}
                                                        className="px-2 py-0.5 mt-1 text-[10px] bg-sky-50 text-sky-600 border border-sky-200 rounded cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors block text-center"
                                                        title="クリックで発行済を解除"
                                                    >請求(懇) 済</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                            <div className="text-sm font-medium">
                                                <span 
                                                    className={(() => {
                                                        const nameKey = `${(app.input_name || '').replace(/[\s\u3000]+/g, '')}|${(app.input_email || '').toLowerCase().trim()}`;
                                                        const personStatus = personStatusMap.get(nameKey);
                                                        
                                                        if (personStatus?.isBoth) return 'text-red-600 font-bold underline decoration-red-300';
                                                        if (personStatus?.isHybrid) return 'text-green-600 font-bold';
                                                        return 'text-gray-900';
                                                    })()}
                                                    title={(() => {
                                                        const nameKey = `${(app.input_name || '').replace(/[\s\u3000]+/g, '')}|${(app.input_email || '').toLowerCase().trim()}`;
                                                        return personStatusMap.get(nameKey)?.debug || '';
                                                    })()}
                                                >
                                                    {app.input_name}
                                                </span>
                                                {((nameCounts[(app.input_name || '').trim()] || 0) > 1 && !isIgnored) && (
                                                    <div className="mt-1">
                                                        {app.is_duplicate_confirmed ? (
                                                            <span
                                                                onClick={() => handleDuplicateClick(app)}
                                                            >
                                                                同姓確認済
                                                            </span>
                                                        ) : (
                                                            <span
                                                                onClick={() => handleDuplicateClick(app)}
                                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200 transition-colors"
                                                                title="クリックして操作を選択"
                                                            >
                                                                同姓あり要確認
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {/* 紹介老EチE */}
                                                {app.tags?.includes('ご紹介') && (
                                                    <div className="mt-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            ご紹介
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{furigana}</div>
                                            <div className="text-xs text-gray-400">{app.input_email}</div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="text-sm text-gray-900">{rankName}</div>
                                            {app.remarks && (
                                                <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap max-w-xs">{app.remarks}</div>
                                            )}
                                            {isAlert && (
                                                <button
                                                    onClick={() => confirmProductAlert(app.id, app.tags)}
                                                    className="mt-2 text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50"
                                                >
                                                    確認済にする
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                            <div className="text-sm text-gray-500">{gen}</div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="text-sm text-gray-900">
                                                <span className="font-bold text-xs text-gray-400 block">講義:</span>
                                                {(() => {
                                                    const pType = app.participation_type || 'venue';
                                                    if (pType === 'online') return '-';
                                                    return getVenueDisplayName(app.venue || '', 'venue');
                                                })()}
                                            </div>
                                            {(app.online_venues || app.participation_type === 'online') && (
                                                <div className="text-sm text-gray-900 mt-1">
                                                    <span className="font-bold text-xs text-gray-400 block">オンライン対象:</span>
                                                    {app.online_venues || '-'}
                                                </div>
                                            )}
                                            <div className="text-sm text-gray-900 mt-1">
                                                <span className="font-bold text-xs text-gray-400 block">懇親会:</span>
                                                {app.participation_type === 'online'
                                                    ? <span className="text-xs text-gray-400">参加不可</span>
                                                    : getVenueDisplayName(app.social_venue || '', 'venue')
                                                }
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 align-top">
                                            <div className="flex flex-col items-start gap-1">
                                                <span>¥{app.total_amount.toLocaleString()}</span>
                                                {(() => {
                                                    let isMismatched = false;
                                                    // 商品マスタとのマッチング
                                                    const matchedLink = matchProduct(paymentLinksData, {
                                                        venue: app.venue || '',
                                                        social_venue: app.social_venue || '',
                                                        participation_type: app.participation_type || 'venue',
                                                        online_venues: app.online_venues,
                                                        rank_id: app.members?.ranks?.id ? String(app.members.ranks.id) : undefined,
                                                        rank_name: rankName,
                                                        payment_key: app.payment_key
                                                    });
                                                    
                                                    if (matchedLink && (Number(matchedLink.lecture_fee) > 0 || Number(matchedLink.social_fee) > 0)) {
                                                        const expectedTotal = Number(matchedLink.lecture_fee || 0) + Number(matchedLink.social_fee || 0);
                                                        if (expectedTotal !== app.total_amount) isMismatched = true;
                                                    } else {
                                                        // Fallback logic Check (旧データ・マスタ未登録時)
                                                        let expectedSocial = 0;
                                                        const normalizedSocial = normalizeVenue(app.social_venue);
                                                        if (normalizedSocial === '東京' || normalizedSocial === '東京・福岡') {
                                                            expectedSocial = baseSocialFeeTokyo;
                                                        } else if (normalizedSocial === '福岡') {
                                                            expectedSocial = baseSocialFeeFukuoka;
                                                        }
                                                        
                                                        const lecture = app.total_amount - expectedSocial;
                                                        // 0円お申込み（無料・未マッチング）は除外
                                                        if (lecture < 0 && app.total_amount > 0) isMismatched = true;
                                                    }
                                                    
                                                    if (isMismatched) {
                                                        return (
                                                            <div className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded shadow-sm" title="商品マスタや設定からの算出額と実際の決済額が一致していません。割引や例外的な決済の可能性があります。">
                                                                <span>⚠️</span>
                                                                <span className="font-bold">金額アンマッチ</span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            <div className="text-xs text-gray-400 select-all cursor-pointer truncate max-w-[150px] mt-1" title={displayProductName}>{displayProductName}</div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 flex flex-col space-y-1 align-top">
                                            <div className="space-x-2">
                                                <button onClick={() => openEditModal(app)} className="text-indigo-600 hover:text-indigo-900">編集</button>
                                                {app.payment_status !== 'cancelled' ? (
                                                    <button onClick={() => handleCancel(app.id)} className="text-red-600 hover:text-red-900">キャンセル</button>
                                                ) : (
                                                    <button onClick={() => handleUncancel(app.id)} className="text-green-600 hover:text-green-900 font-bold">キャンセル解除</button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleResend(app.id)} className="text-gray-500 hover:text-gray-900 text-xs text-left">再送</button>
                                                <button onClick={() => handlePreviewEmail(app.id)} className="text-blue-500 hover:text-blue-900 text-xs text-left">👁 閲覧</button>
                                            </div>
                                            <div className="pt-1 border-t border-gray-100 mt-1 space-y-1">
                                                <button onClick={() => {
                                                    const url = `${window.location.origin}/receipt/${app.id}`;
                                                    navigator.clipboard.writeText(url).then(() => alert('お客様用 書類発行URLをコピーしました。\n' + url));
                                                }} className="text-indigo-600 hover:text-indigo-900 text-xs text-left block w-full">📋 書類URLコピー</button>
                                                <button onClick={() => window.open(`/receipt/${app.id}?admin=true`, '_blank')} className="text-teal-600 hover:text-teal-900 text-xs text-left block w-full">📄 (管理用)プレビュー・作成</button>
                                            </div>
                                            <div className="pt-1 border-t border-gray-100 mt-1">
                                                <button onClick={() => handleDeleteApp(app.id)} className="text-red-500 hover:text-red-700 text-xs text-left font-bold flex items-center">
                                                    <span className="mr-1"></span> 完全に削除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>


            {/* Edit Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                        <div className="bg-white p-5 rounded-lg shadow-xl w-[500px]">
                            <h3 className="text-lg font-bold mb-4">申込内容の修正</h3>
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">名前</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={editForm.input_name || ''}
                                            onChange={e => setEditForm({ ...editForm, input_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">フリガナ</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={editForm.input_furigana || ''}
                                            onChange={e => setEditForm({ ...editForm, input_furigana: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">Email</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={editForm.input_email || ''}
                                            onChange={e => setEditForm({ ...editForm, input_email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">期(Term)</label>
                                        <input
                                            type="number"
                                            className="border w-full p-2 rounded"
                                            value={editForm.member_generation || ''}
                                            onChange={e => setEditForm({ ...editForm, member_generation: Number(e.target.value) })}
                                            placeholder="数字のみ (例 1)"
                                        />
                                    </div>
                                </div>

                                {/* Product Name with Auto-Populate */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 text-indigo-700">商品名 (マスタ確定名)</label>
                                    <input
                                        type="text"
                                        className="border w-full p-2 rounded bg-gray-100 cursor-not-allowed"
                                        value={editForm.payment_key || ''}
                                        readOnly
                                    />
                                </div>



                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-gray-700">参加形式</label>
                                    <select
                                        className="border w-full p-2 rounded bg-white"
                                        value={editForm.participation_type || 'venue'}
                                        onChange={(e) => handleFieldChange('participation_type', e.target.value)}
                                    >
                                        <option value="venue">会場参加</option>
                                        <option value="online">オンライン視聴</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        {editForm.participation_type === 'online' ? (
                                            <>
                                                <label className="block text-sm font-bold text-gray-700">オンライン対象会場 <span className="text-red-500">*</span></label>
                                                <select
                                                    className="border w-full p-2 rounded bg-indigo-50"
                                                    value={editForm.online_venues || ''}
                                                    onChange={(e) => handleFieldChange('online_venues', e.target.value)}
                                                >
                                                    <option value="">対象会場を選択</option>
                                                    {venueList.filter(v => v.type === 'lecture').map(opt => (
                                                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                                                    ))}
                                                    <option value="東京・福岡">東京・福岡</option>
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label className="block text-sm font-bold text-gray-700">参加会場 (講義)</label>
                                                <select
                                                    className="border w-full p-2 rounded"
                                                    value={editForm.venue || ''}
                                                    onChange={(e) => handleFieldChange('venue', e.target.value)}
                                                >
                                                    <option value="">(選択なし)</option>
                                                    {venueList.filter(v => v.type === 'lecture').map(opt => (
                                                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                                                    ))}
                                                    <option value="東京・福岡">東京・福岡</option>
                                                    <option value="参加しない">参加しない</option>
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">参加会場 (懇親会)</label>
                                        <select
                                            className="border w-full p-2 rounded bg-white disabled:bg-gray-100"
                                            value={editForm.social_venue || ''}
                                            onChange={e => handleFieldChange('social_venue', e.target.value)}
                                            disabled={!editForm.venue || editForm.participation_type === 'online'}
                                        >
                                            <option value="">(選択なし)</option>
                                            {(() => {
                                                const lectureVenue = editForm.venue;
                                                if (!lectureVenue) return null;
                                                
                                                const socialVenues = venueList.filter(v => v.type === 'social');
                                                const available = getSocialOptionsForLecture(lectureVenue, socialVenues);

                                                return (
                                                    <>
                                                        {available.map(opt => (
                                                            <option key={opt.id} value={opt.name}>{opt.name}</option>
                                                        ))}
                                                        {/* マスタに明示的にない場合でも、「東京・福岡」が講義にあれば懇親会でも出せるように補完 */}
                                                        {lectureVenue === '東京・福岡' && !available.some(a => a.name === '東京・福岡') && (
                                                            <option value="東京・福岡">東京・福岡</option>
                                                        )}
                                                        <option value="参加しない">参加しない</option>
                                                    </>
                                                );
                                            })()}
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t pt-2 my-2"></div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">決済ステータス</label>
                                        <select
                                            className={`border w-full p-2 rounded ${editForm.payment_status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-white'}`}
                                            value={editForm.payment_status || ''}
                                            onChange={e => setEditForm({ ...editForm, payment_status: e.target.value as any })}
                                        >
                                            <option value="unpaid">未決済</option>
                                            <option value="paid">決済済</option>
                                            <option value="cancelled">キャンセル</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">判定属性</label>
                                        <select
                                            className="border w-full p-2 rounded bg-indigo-50"
                                            value={editForm.applied_rank_name || ''}
                                            onChange={e => handleFieldChange('applied_rank_name', e.target.value)}
                                        >
                                            <option value="">(ランクなし)</option>
                                            {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 text-indigo-700">合計金額 (自動計算/マスタ連動)</label>
                                        <input
                                            type="number"
                                            className="border w-full p-2 rounded bg-gray-100 cursor-not-allowed"
                                            value={editForm.total_amount || 0}
                                            readOnly
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700">備考</label>
                                    <textarea
                                        className="border w-full p-2 rounded h-20"
                                        value={editForm.remarks || ''}
                                        onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={submitEdit}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                                    >
                                        更新
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Email Preview Modal */}
            {showEmailModal && emailPreview && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[600px] h-[80vh] flex flex-col">
                        <h3 className="text-lg font-bold mb-4">送信済みメール (プレビュー)</h3>
                        <div className="mb-2 space-y-1">
                            <div><span className='font-bold'>宛先:</span> {emailPreview.email || '(宛先不明)'}</div>
                            {emailPreview.cc && <div><span className="font-bold text-gray-500">CC:</span> {emailPreview.cc}</div>}
                            {emailPreview.bcc && <div><span className="font-bold text-gray-500">BCC:</span> {emailPreview.bcc}</div>}
                        </div>
                        <div className="mb-2">
                            <span className="font-bold">件名:</span> {emailPreview.subject}
                        </div>
                        <div className="flex-1 overflow-y-auto border p-4 bg-gray-50 rounded whitespace-pre-wrap font-mono text-sm">
                            {emailPreview.content}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setShowEmailModal(false)} className="bg-gray-300 px-4 py-2 rounded">閉じる</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Resend Modal */}
            {customResendModal.isOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[600px] h-[80vh] flex flex-col">
                        <h3 className="text-lg font-bold mb-4 text-indigo-700 flex items-center gap-2">
                            <span>✉️</span> 再送メールの編集
                        </h3>
                        
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-4 rounded-r shadow-sm">
                            <p className="text-xs text-amber-800 leading-relaxed">
                                <span className="font-bold">⚠️ 注意事項</span><br />
                                ここでの修正内容は、<span className="font-bold">今回の送信にのみ</span>反映されます。<br />
                                申込者データやオリジナルのテンプレートには保存・反映されませんので、安心して調整してください。
                            </p>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">内容を編集して「送信」ボタンを押してください。</p>

                        <div className="mb-2">
                            <span className="font-bold text-sm">宛先:</span> {customResendModal.email}
                        </div>

                        <div className="mb-2">
                            <label className="block text-sm font-bold text-gray-700">件名</label>
                            <input
                                className="border w-full p-2 rounded"
                                value={customResendModal.subject}
                                onChange={e => setCustomResendModal({ ...customResendModal, subject: e.target.value })}
                            />
                        </div>

                        <div className="flex-1 mb-2">
                            <label className="block text-sm font-bold text-gray-700">本文</label>
                            <textarea
                                className="border w-full p-2 rounded h-full font-mono text-sm resize-none"
                                value={customResendModal.body}
                                onChange={e => setCustomResendModal({ ...customResendModal, body: e.target.value })}
                            />
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setCustomResendModal({ ...customResendModal, isOpen: false })}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={submitCustomResend}
                                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold"
                            >
                                送信
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[800px] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">システム設定</h3>

                        <div className="mb-6">
                            <h4 className="font-bold text-gray-700 mb-2">管理者設定</h4>
                            <div className="mb-2">
                                <label className="block text-sm text-gray-600 font-bold">管理者CCメールアドレス</label>
                                <p className="text-xs text-gray-500 mb-1">
                                    お申込み者（受講生）に送られるメールの副本(CC)が、このアドレスに送信されます。
                                </p>
                                <input
                                    className="border w-full p-2 rounded"
                                    value={adminEmail}
                                    onChange={e => setAdminEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm text-gray-600 font-bold">テストメール送信先</label>
                                <p className="text-xs text-gray-500 mb-1">
                                    システムテスト用メールの送信先です。
                                </p>
                                <input
                                    className="border w-full p-2 rounded"
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                    placeholder="test@example.com"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="font-bold text-gray-700 mb-2">メールテンプレート設定</h4>

                            {/* Tabs */}
                            <div className="flex border-b mb-4">
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'matched' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('matched')}
                                >
                                    申込受付(商品マッチ)
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'general' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('general')}
                                >
                                    申込受付(一般)
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'free' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('free')}
                                >
                                    0円(会場)
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'free_online' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('free_online')}
                                >
                                    0円(オンライン)
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'resend' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('resend')}
                                >
                                    再送メール
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'forgot' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('forgot')}
                                >
                                    パスワード忘れ
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'multiple' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('multiple')}
                                >
                                    複数名
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'reminder' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('reminder')}
                                >
                                    リマインド設定
                                </button>
                            </div>

                            <div className="bg-yellow-50 p-3 rounded text-xs mb-2">
                                利用可能な変数:
                                {selectedTemplateTab === 'reminder' ? (
                                    <> {'{{name}}'}, {'{{rank}}'}, {'{{venue}}'}, {'{{social_venue}}'}, {'{{amount}}'}, {'{{payment_link_section}}'}, {'{{lecture_date}}'}, {'{{viewing_link}}'}, {'{{zoom_id}}'}, {'{{zoom_pass}}'}, {'{{zoom_info}}'}</>
                                ) : selectedTemplateTab !== 'forgot' ? (
                                    <> {'{{name}}'}, {'{{rank}}'}, {'{{venue}}'}, {'{{social_venue}}'}, {'{{amount}}'}, {'{{payment_link_section}}'}</>
                                ) : (
                                    <> {'{{username}}'}, {'{{reset_link}}'}</>
                                )}
                            </div>

                            {selectedTemplateTab === 'matched' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(商品マッチ時)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplate.subject}
                                            onChange={e => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplate.body}
                                            onChange={e => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplate(DEFAULT_TEMPLATE)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'general' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(一般マッチなし)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateGeneral.subject}
                                            onChange={e => setEmailTemplateGeneral({ ...emailTemplateGeneral, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateGeneral.body}
                                            onChange={e => setEmailTemplateGeneral({ ...emailTemplateGeneral, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateGeneral(DEFAULT_TEMPLATE_GENERAL)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'free' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(0円無料 - 会場)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateFree.subject}
                                            onChange={e => setEmailTemplateFree({ ...emailTemplateFree, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateFree.body}
                                            onChange={e => setEmailTemplateFree({ ...emailTemplateFree, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateFree(DEFAULT_TEMPLATE_FREE)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'free_online' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(0円無料 - オンライン)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateFreeOnline.subject}
                                            onChange={e => setEmailTemplateFreeOnline({ ...emailTemplateFreeOnline, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateFreeOnline.body}
                                            onChange={e => setEmailTemplateFreeOnline({ ...emailTemplateFreeOnline, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateFreeOnline(DEFAULT_TEMPLATE_FREE_ONLINE)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'resend' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(再送)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateResend.subject}
                                            onChange={e => setEmailTemplateResend({ ...emailTemplateResend, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateResend.body}
                                            onChange={e => setEmailTemplateResend({ ...emailTemplateResend, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateResend(DEFAULT_TEMPLATE_RESEND)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'forgot' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(パスワードリセット)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateForgotPass.subject}
                                            onChange={e => setEmailTemplateForgotPass({ ...emailTemplateForgotPass, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateForgotPass.body}
                                            onChange={e => setEmailTemplateForgotPass({ ...emailTemplateForgotPass, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateForgotPass(DEFAULT_TEMPLATE_FORGOT_PASS)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}
                            
                            {selectedTemplateTab === 'multiple' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名(複数名申し込み)</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={emailTemplateMultiple.subject}
                                            onChange={e => setEmailTemplateMultiple({ ...emailTemplateMultiple, subject: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 text-xs">本文</label>
                                        <textarea
                                            className="border w-full p-2 rounded h-60 font-mono text-sm"
                                            value={emailTemplateMultiple.body}
                                            onChange={e => setEmailTemplateMultiple({ ...emailTemplateMultiple, body: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={() => setEmailTemplateMultiple(DEFAULT_TEMPLATE_MULTIPLE)} className="text-xs text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                </>
                            )}

                            {selectedTemplateTab === 'reminder' && (
                                <div className="space-y-6">
                                    <div className="flex gap-4 border-b">
                                        <button onClick={() => setReminderSettingsTab('venue')} className={`px-3 py-1 text-sm ${reminderSettingsTab === 'venue' ? 'border-b-2 border-indigo-500 font-bold' : ''}`}>会場参加者向け</button>
                                        <button onClick={() => setReminderSettingsTab('online')} className={`px-3 py-1 text-sm ${reminderSettingsTab === 'online' ? 'border-b-2 border-indigo-500 font-bold' : ''}`}>ライブ視聴者向け</button>
                                    </div>

                                    {/* エリア別設定 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded border">
                                        {Array.from(new Set((venueList || []).filter(v => v && ['tokyo', 'fukuoka'].includes(v.area)).map(v => v.area))).sort().map(area => (
                                            <div key={area} className="space-y-2">
                                                <h5 className="font-bold text-sm text-indigo-700 uppercase">{String(area || '').toUpperCase()} エリア</h5>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 font-bold mb-1">開始日時 ({"{{lecture_date}}"}変数用)</label>
                                                        <div className="flex flex-col gap-1">
                                                            <input 
                                                                type="date"
                                                                className="border w-full p-2 rounded text-sm bg-white hover:border-indigo-400 transition-colors" 
                                                                value={(lectureDates[area] || '').split('T')[0]} 
                                                                onChange={e => {
                                                                    const time = (lectureDates[area] || '').split('T')[1] || '00:00';
                                                                    setLectureDates({...lectureDates, [area]: `${e.target.value}T${time}`});
                                                                }} 
                                                            />
                                                            <DrumTimePicker 
                                                                value={lectureDates[area] || ''}
                                                                onChange={val => setLectureDates({...lectureDates, [area]: val})}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 font-bold mb-1">終了日時</label>
                                                        <div className="flex flex-col gap-1">
                                                            <input 
                                                                type="date"
                                                                className="border w-full p-2 rounded text-sm bg-white hover:border-indigo-400 transition-colors" 
                                                                value={(lectureEndDates[area] || '').split('T')[0]} 
                                                                onChange={e => {
                                                                    const time = (lectureEndDates[area] || '').split('T')[1] || '00:00';
                                                                    setLectureEndDates({...lectureEndDates, [area]: `${e.target.value}T${time}`});
                                                                }} 
                                                            />
                                                            <DrumTimePicker 
                                                                value={lectureEndDates[area] || ''}
                                                                onChange={val => setLectureEndDates({...lectureEndDates, [area]: val})}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-gray-500">視聴リンク ({"{{viewing_link}}"}変数用)</label>
                                                    <input 
                                                        className="border w-full p-2 rounded text-sm mb-2" 
                                                        value={onlineViewingLinks[area] || ''} 
                                                        placeholder="https://zoom.us/..."
                                                        onChange={e => setOnlineViewingLinks({...onlineViewingLinks, [area]: e.target.value})} 
                                                    />
                                                    <label className="block text-[10px] text-gray-500">ZOOM ID ({"{{zoom_id}}"}変数用)</label>
                                                    <input 
                                                        className="border w-full p-2 rounded text-sm mb-2" 
                                                        value={zoomIds[area] || ''} 
                                                        placeholder="123 456 7890"
                                                        onChange={e => setZoomIds({...zoomIds, [area]: e.target.value})} 
                                                    />
                                                    <label className="block text-[10px] text-gray-500">パスワード ({"{{zoom_pass}}"}変数用)</label>
                                                    <input 
                                                        className="border w-full p-2 rounded text-sm" 
                                                        value={zoomPasses[area] || ''} 
                                                        placeholder="password123"
                                                        onChange={e => setZoomPasses({...zoomPasses, [area]: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* テンプレート編集 */}
                                    <div className="space-y-4">
                                        {reminderSettingsTab === 'venue' ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">会場参加・決済済用</label>
                                                    <input 
                                                        className="border w-full p-1 rounded text-sm mb-1" 
                                                        value={emailTemplateReminderVenuePaid?.subject || ''} 
                                                        onChange={e => setEmailTemplateReminderVenuePaid(prev => ({...(prev || {subject: '', body: ''}), subject: e.target.value}))} 
                                                    />
                                                    <textarea 
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs" 
                                                        value={emailTemplateReminderVenuePaid?.body || ''} 
                                                        onChange={e => setEmailTemplateReminderVenuePaid(prev => ({...(prev || {subject: '', body: ''}), body: e.target.value}))} 
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderVenuePaid(DEFAULT_TEMPLATE_REMINDER_VENUE_PAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">会場参加・未決済用</label>
                                                    <input 
                                                        className="border w-full p-1 rounded text-sm mb-1" 
                                                        value={emailTemplateReminderVenueUnpaid?.subject || ''} 
                                                        onChange={e => setEmailTemplateReminderVenueUnpaid(prev => ({...(prev || {subject: '', body: ''}), subject: e.target.value}))} 
                                                    />
                                                    <textarea 
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs" 
                                                        value={emailTemplateReminderVenueUnpaid?.body || ''} 
                                                        onChange={e => setEmailTemplateReminderVenueUnpaid(prev => ({...(prev || {subject: '', body: ''}), body: e.target.value}))} 
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderVenueUnpaid(DEFAULT_TEMPLATE_REMINDER_VENUE_UNPAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">ライブ視聴・決済済用</label>
                                                    <input 
                                                        className="border w-full p-1 rounded text-sm mb-1" 
                                                        value={emailTemplateReminderOnlinePaid?.subject || ''} 
                                                        onChange={e => setEmailTemplateReminderOnlinePaid(prev => ({...(prev || {subject: '', body: ''}), subject: e.target.value}))} 
                                                    />
                                                    <textarea 
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs" 
                                                        value={emailTemplateReminderOnlinePaid?.body || ''} 
                                                        onChange={e => setEmailTemplateReminderOnlinePaid(prev => ({...(prev || {subject: '', body: ''}), body: e.target.value}))} 
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderOnlinePaid(DEFAULT_TEMPLATE_REMINDER_ONLINE_PAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">ライブ視聴・未決済用</label>
                                                    <input 
                                                        className="border w-full p-1 rounded text-sm mb-1" 
                                                        value={emailTemplateReminderOnlineUnpaid?.subject || ''} 
                                                        onChange={e => setEmailTemplateReminderOnlineUnpaid(prev => ({...(prev || {subject: '', body: ''}), subject: e.target.value}))} 
                                                    />
                                                    <textarea 
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs" 
                                                        value={emailTemplateReminderOnlineUnpaid?.body || ''} 
                                                        onChange={e => setEmailTemplateReminderOnlineUnpaid(prev => ({...(prev || {subject: '', body: ''}), body: e.target.value}))} 
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderOnlineUnpaid(DEFAULT_TEMPLATE_REMINDER_ONLINE_UNPAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mb-6 border-t pt-4">
                            <h4 className="font-bold text-gray-700 mb-2">マスタ管理へのリンク</h4>
                            <div className="flex gap-4">
                                <Link href="/admin/products" className="text-blue-600 hover:underline flex items-center">
                                    商品・決済リンク管理画面へ →
                                </Link>
                                <Link href="/admin/terms" className="text-blue-600 hover:underline flex items-center">
                                    期マスタ管理画面へ →
                                </Link>
                                <Link href="/admin/venues" className="text-blue-600 hover:underline flex items-center">
                                    会場マスタ管理画面へ →
                                </Link>
                                <Link href="/admin/settings" className="text-blue-600 hover:underline flex items-center">
                                    申込画面表示設定へ (タイトル・お知らせ) →
                                </Link>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                閉じる
                            </button>
                            <div className="flex-1 text-[10px] text-gray-300 flex items-end ml-4">
                                Version: {VERSION}
                            </div>
                            <button
                                onClick={saveSettings}
                                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold"
                            >
                                設定を保存
                            </button>
                        </div>
                    </div >
                </div >
            )}

            {/* Reminder Confirmation Modal */}
            {showReminderModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                        <h3 className="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
                            <span>🚀</span> 一括リマインド送信の確認
                        </h3>
                        
                        <div className="bg-indigo-50 p-4 rounded-md mb-6 border border-indigo-100">
                            <p className="text-sm text-gray-700 font-bold mb-3">送信対象の内訳:</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-gray-500 mb-1 font-bold">■ 会場参加 (合計: {reminderSummary.tokyo_venue + reminderSummary.fukuoka_venue}名)</p>
                                    <ul className="pl-3 space-y-1">
                                        <li>東京エリア: {reminderSummary.tokyo_venue}名</li>
                                        <li>福岡エリア: {reminderSummary.fukuoka_venue}名</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1 font-bold">■ ライブ視聴 (合計: {reminderSummary.tokyo_online + reminderSummary.fukuoka_online}名)</p>
                                    <ul className="pl-3 space-y-1">
                                        <li>東京エリア配信分: {reminderSummary.tokyo_online}名</li>
                                        <li>福岡エリア配信分: {reminderSummary.fukuoka_online}名</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-indigo-100 flex justify-between text-sm">
                                <div>
                                    <span className="text-gray-600">決済済:</span> <span className="font-bold text-green-600">{reminderSummary.paid}名</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">未決済:</span> <span className="font-bold text-red-600">{reminderSummary.unpaid}名</span>
                                </div>
                                <div className="border-l pl-3 border-indigo-200">
                                    <span className="text-gray-600">キャンセル済:</span> <span className="font-bold text-gray-400">{reminderSummary.cancelled}名</span>
                                </div>
                            </div>
                            {reminderSummary.cancelled > 0 && (
                                <p className="text-[10px] text-red-500 mt-2 font-bold">
                                    ※キャンセル済みのデータは送信対象から自動的に除外されます。
                                </p>
                            )}
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-700 font-bold mb-2">送信文面のプレビュー:</p>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                <div className="border rounded bg-gray-50">
                                    <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold border-b flex justify-between">
                                        <span>【会場参加・決済済】</span>
                                        <span className="text-gray-500 font-normal">件名: {emailTemplateReminderVenuePaid.subject}</span>
                                    </div>
                                    <pre className="p-3 text-[10px] whitespace-pre-wrap font-sans text-gray-600">
                                        {emailTemplateReminderVenuePaid.body}
                                    </pre>
                                </div>
                                <div className="border rounded bg-gray-50">
                                    <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold border-b flex justify-between">
                                        <span>【会場参加・未決済】</span>
                                        <span className="text-gray-500 font-normal">件名: {emailTemplateReminderVenueUnpaid.subject}</span>
                                    </div>
                                    <pre className="p-3 text-[10px] whitespace-pre-wrap font-sans text-gray-600">
                                        {emailTemplateReminderVenueUnpaid.body}
                                    </pre>
                                </div>
                                <div className="border rounded bg-gray-50">
                                    <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold border-b flex justify-between">
                                        <span>【ライブ視聴・決済済】</span>
                                        <span className="text-gray-500 font-normal">件名: {emailTemplateReminderOnlinePaid.subject}</span>
                                    </div>
                                    <pre className="p-3 text-[10px] whitespace-pre-wrap font-sans text-gray-600">
                                        {emailTemplateReminderOnlinePaid.body}
                                    </pre>
                                </div>
                                <div className="border rounded bg-gray-50">
                                    <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold border-b flex justify-between">
                                        <span>【ライブ視聴・未決済】</span>
                                        <span className="text-gray-500 font-normal">件名: {emailTemplateReminderOnlineUnpaid.subject}</span>
                                    </div>
                                    <pre className="p-3 text-[10px] whitespace-pre-wrap font-sans text-gray-600">
                                        {emailTemplateReminderOnlineUnpaid.body}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-gray-500 space-y-1 mb-6 bg-yellow-50 p-3 rounded border border-yellow-100">
                            <p>※ 設定画面で登録した各エリアの「開催日時」および「視聴リンク」が自動的に挿入されます。</p>
                            <p>※ 決済状況や参加タイプに応じて、上記の4種類のテンプレートから自動選択されます。</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowReminderModal(false)}
                                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                                disabled={reminderSending}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={submitReminders}
                                className={`px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow flex items-center gap-2 ${reminderSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={reminderSending}
                            >
                                {reminderSending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        送信中...
                                    </>
                                ) : '今すぐ送信を開始する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Action Modal */}
            {
                showDuplicateModal && duplicateTargetApp && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                        <div className="bg-white p-5 rounded-lg shadow-xl w-[400px]">
                            <h3 className="text-lg font-bold mb-4">重複確認の操作</h3>
                            <p className="mb-6 text-sm text-gray-600">
                                「{duplicateTargetApp.input_name}」さんの重複確認ラベルに対して操作を選択してください。
                            </p>
                            <div className="flex flex-col gap-3">
                                {duplicateTargetApp.is_duplicate_confirmed ? (
                                    <button
                                        onClick={revertDuplicateStatus}
                                        className="w-full bg-yellow-100 text-yellow-800 px-4 py-3 rounded hover:bg-yellow-200 border border-yellow-300 font-bold"
                                    >
                                        「要確認」に戻す
                                        <span className="block text-xs font-normal mt-1 text-yellow-700">再度アラート表示されます</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => confirmDuplicate(duplicateTargetApp.id)}
                                        className="w-full bg-green-100 text-green-800 px-4 py-3 rounded hover:bg-green-200 border border-green-300 font-bold"
                                    >
                                        「確認済」にする
                                        <span className="block text-xs font-normal mt-1 text-green-700">確認済ラベルに変更します</span>
                                    </button>
                                )}
                                <button
                                    onClick={ignoreDuplicate}
                                    className="w-full bg-gray-100 text-gray-800 px-4 py-3 rounded hover:bg-gray-200 border border-gray-300 font-bold"
                                >
                                    ラベルを外す
                                    <span className="block text-xs font-normal mt-1 text-gray-600">今後このレコードに重複アラートを表示しません</span>
                                </button>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowDuplicateModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 新規登録モーダル */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4 text-green-700">新規登録（手動・自動メールなし）</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600">氏名 (必須)</label>
                                <input
                                    className="border w-full p-2 rounded focus:ring-green-500 focus:border-green-500"
                                    value={createForm.input_name || ''}
                                    onChange={e => setCreateForm({ ...createForm, input_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">フリガナ</label>
                                <input
                                    className="border w-full p-2 rounded focus:ring-green-500 focus:border-green-500"
                                    value={createForm.input_furigana || ''}
                                    onChange={e => setCreateForm({ ...createForm, input_furigana: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm text-gray-600">Email</label>
                                <input
                                    type="email"
                                    className="border w-full p-2 rounded focus:ring-green-500 focus:border-green-500"
                                    value={createForm.input_email || ''}
                                    onChange={e => setCreateForm({ ...createForm, input_email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600">講義会場 (必須)</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.venue || ''}
                                    onChange={e => handleCreateFieldChange('venue', e.target.value)}
                                >
                                    <option value="">選択してください</option>
                                    {venueList.filter(v => v.type === 'lecture').map(v => (
                                        <option key={v.id} value={v.name}>{v.name}</option>
                                    ))}
                                    <option value="東京・福岡">東京・福岡</option>
                                    <option value="参加しない">参加しない</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">懇親会</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.social_venue || 'none'}
                                    onChange={e => handleCreateFieldChange('social_venue', e.target.value)}
                                >
                                    <option value="none">参加しない</option>
                                    {(() => {
                                        const lectureVenue = createForm.venue;
                                        const socialVenues = venueList.filter(v => v.type === 'social');
                                        const available = getSocialOptionsForLecture(lectureVenue, socialVenues);
                                        
                                        return (
                                            <>
                                                {available.map(v => (
                                                    <option key={v.id} value={v.name}>{v.name}</option>
                                                ))}
                                                {lectureVenue === '東京・福岡' && !available.some(a => a.name === '東京・福岡') && (
                                                    <option value="東京・福岡">東京・福岡</option>
                                                )}
                                            </>
                                        );
                                    })()}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600">判定属性</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.applied_rank_name || '一般'}
                                    onChange={e => handleCreateFieldChange('applied_rank_name', e.target.value)}
                                >
                                    {ranks.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">期 (任意)</label>
                                <input
                                    type="number"
                                    className="border w-full p-2 rounded"
                                    value={createForm.member_generation || ''}
                                    placeholder="例: 10"
                                    onChange={e => setCreateForm({ ...createForm, member_generation: e.target.value ? parseInt(e.target.value) : undefined })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600">参加タイプ</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.participation_type || 'venue'}
                                    onChange={e => handleCreateFieldChange('participation_type', e.target.value as 'venue' | 'online')}
                                >
                                    <option value="venue">会場</option>
                                    <option value="online">オンライン</option>
                                </select>
                            </div>

                            {createForm.participation_type === 'online' && (
                                <div>
                                    <label className="block text-sm text-gray-600">オンライン対象会場 <span className="text-red-500">*</span></label>
                                    <select
                                        className="border w-full p-2 rounded"
                                        value={(createForm as any).online_venues || ''}
                                        onChange={e => handleCreateFieldChange('online_venues', e.target.value)}
                                    >
                                        <option value="">選択してください</option>
                                        {venueList.filter(v => v.type === 'lecture').map(opt => (
                                            <option key={opt.id} value={opt.name}>{opt.name}</option>
                                        ))}
                                        <option value="東京・福岡">東京・福岡</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">LIVE視聴参加者がどの会場の配信を視聴するかを選択してください</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-gray-600 flex justify-between">
                                    <span>金額</span>
                                </label>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        className="border w-full p-2 rounded text-right pr-2"
                                        value={createForm.total_amount || 0}
                                        onChange={e => setCreateForm({ ...createForm, total_amount: parseInt(e.target.value) || 0 })}
                                    />
                                    <span className="ml-2">円</span>
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm text-gray-600">備考 (手動追加など)</label>
                                <textarea
                                    className="border w-full p-2 rounded h-20"
                                    value={createForm.remarks || ''}
                                    placeholder="管理ダッシュボードからの手動登録"
                                    onChange={e => setCreateForm({ ...createForm, remarks: e.target.value })}
                                />
                            </div>

                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setCreateForm({});
                                }}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                                disabled={creating}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleCreateApp}
                                disabled={creating}
                                className={`px-6 py-2 rounded text-white font-bold ${creating ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {creating ? '登録中...' : '登録する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 未申込者モーダル */}
            {showUnappliedModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-xl font-bold">お申し込み未完了の受講生</h2>
                            <button onClick={() => setShowUnappliedModal(false)} className="text-gray-500 hover:text-gray-700">
                                ✕ 閉じる
                            </button>
                        </div>
                        
                        <div className="p-4 flex-grow overflow-auto bg-gray-50">
                            {loadingUnapplied ? (
                                <div className="text-center py-10">
                                    <p className="text-gray-500">データを照合しています...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 flex justify-between items-center">
                                        <p className="text-sm text-gray-600">
                                            現在の受講生マスターから、お申し込みデータ（キャンセルを除く）に存在しない方を表示しています。
                                        </p>
                                        <div className="flex gap-4 items-center">
                                            <div className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full text-sm">
                                                未申込: {unappliedMembers.length} 名
                                            </div>
                                            <button 
                                                onClick={downloadUnappliedCSV}
                                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center"
                                                disabled={unappliedMembers.length === 0}
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                CSV出力
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {unappliedMembers.length === 0 ? (
                                        <div className="text-center py-10 bg-white rounded shadow-sm">
                                            <p className="text-gray-500">全ての受講生のお申し込みが完了しています！</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded shadow-sm overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-200 text-gray-700">
                                                    <tr>
                                                        <th className="p-3 text-left w-20 whitespace-nowrap">期</th>
                                                        <th className="p-3 text-left">氏名</th>
                                                        <th className="p-3 text-left">フリガナ</th>
                                                        <th className="p-3 text-left">メールアドレス</th>
                                                        <th className="p-3 text-left w-32 whitespace-nowrap">属性</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {unappliedMembers.map(member => (
                                                        <tr key={member.id} className="border-t hover:bg-gray-50">
                                                            <td className="p-3 whitespace-nowrap">{member.terms?.name || '-'}</td>
                                                            <td className="p-3 font-bold whitespace-nowrap">{member.name}</td>
                                                            <td className="p-3 text-gray-600 whitespace-nowrap">{member.furigana}</td>
                                                            <td className="p-3">
                                                                <div className="flex items-center">
                                                                    <span className="truncate max-w-xs" title={member.email}>{member.email}</span>
                                                                    {member.email && (
                                                                        <button 
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(member.email);
                                                                                alert('コピーしました: ' + member.email);
                                                                            }}
                                                                            className="ml-2 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-1 flex-shrink-0"
                                                                        >
                                                                            コピー
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 whitespace-nowrap">
                                                                <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                                    {member.ranks?.name || '不明'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
