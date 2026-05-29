'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DrumTimePicker from '@/components/admin/DrumTimePicker';
import { matchProduct, getVenueDisplayName, isOnlineVenue, getSocialOptionsForLecture, normalizeVenue } from '@/lib/venueUtils';
import { normalizeName } from '@/lib/kanjiNormalize';

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
    receipt_date?: string; // 領収日 (タグ用仮想フィールド)
    payment_method?: string; // お支払い方法 (タグ用仮想フィールド)
    parent_application_id?: string | null; // 合算用親ID
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

const formatGeneration = (generation: number | undefined | null): string => {
    if (generation === undefined || generation === null) return '';
    const val = Number(generation);
    if (val === 9991) return '法人';
    if (val === 9992) return '経営幹部';
    if (val === 9999 || val === 0) return '';
    return `${val}期`;
};

// 複数選択コンポーネント
const MultiSelect = ({ label, options, selected, onChange, width = "w-40" }: { label: string, options: { label: string, value: string }[], selected: Set<string>, onChange: (s: Set<string>) => void, width?: string }) => {
    const [open, setOpen] = useState(false);
    const isActive = selected.size > 0;

    return (
        <div className={`relative ${width}`}>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full text-left border-2 rounded px-2 py-1.5 text-sm flex justify-between items-center cursor-pointer transition-all ${
                    isActive
                        ? 'border-red-400 bg-red-50 hover:border-red-500'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
            >
                <span className="flex items-center gap-1 min-w-0">
                    {isActive && (
                        <span className="text-red-500 text-xs flex-shrink-0">🔴</span>
                    )}
                    <span className="truncate block font-medium" style={{ color: isActive ? '#b91c1c' : '#374151' }}>
                        {label}
                    </span>
                    {isActive && (
                        <span className="flex-shrink-0 ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            ×{selected.size}
                        </span>
                    )}
                </span>
                <span className={`text-xs ml-1 flex-shrink-0 ${isActive ? 'text-red-400' : 'text-gray-500'}`}>▼</span>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-20 max-h-80 overflow-y-auto mt-1" style={{ minWidth: '160px' }}>
                        <div className="px-3 py-1.5 bg-gray-50 border-b">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                        </div>
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
                                className={`px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-50 last:border-0 ${
                                    selected.has(opt.value) ? 'bg-red-50' : ''
                                }`}
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
                                    className="pointer-events-none h-4 w-4 text-red-500 focus:ring-0"
                                />
                                <span className={`text-sm truncate select-none ${
                                    selected.has(opt.value) ? 'text-red-700 font-bold' : 'text-gray-700'
                                }`}>{opt.label}</span>
                            </div>
                        ))}
                        {isActive && (
                            <div
                                className="px-3 py-2 bg-red-50 hover:bg-red-100 cursor-pointer flex items-center gap-2 border-t border-red-100"
                                onClick={() => { onChange(new Set()); setOpen(false); }}
                            >
                                <span className="text-xs font-bold text-red-600">✕ フィルタを解除</span>
                            </div>
                        )}
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
    const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid' | 'cancelled' | 'not_required'>('all');
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
    const [editForm, setEditForm] = useState<Partial<Application & { member_generation?: number | string }>>({});
    const [showModal, setShowModal] = useState(false);

    // 合算モーダルの状態
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkParentId, setLinkParentId] = useState<string>('');
    const [linking, setLinking] = useState(false);

    // 新規登録モーダルの状態
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [creating, setCreating] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [showMemberSearch, setShowMemberSearch] = useState(false);
    // 一括削除認証モーダルの状態
    const [showTruncateAuthModal, setShowTruncateAuthModal] = useState(false);
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authVerifying, setAuthVerifying] = useState(false);

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
    const [customResendModal, setCustomResendModal] = useState<{ isOpen: boolean, appId: string | null, subject: string, body: string, email: string, additionalEmail: string, sendToOriginal: boolean }>({ isOpen: false, appId: null, subject: '', body: '', email: '', additionalEmail: '', sendToOriginal: true });

    const [adminEmail, setAdminEmail] = useState('');
    const [adminBccEmail, setAdminBccEmail] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [venueList, setVenueList] = useState<Venue[]>([]);
    const [onlineOptionMaster, setOnlineOptionMaster] = useState<{ id: string, name: string }[]>([]);
    const [ranks, setRanks] = useState<{ id: number, name: string }[]>([]);
    const [termMaster, setTermMaster] = useState<number[]>([]);
    const [applicationActive, setApplicationActive] = useState(true);

    // リマインド関連の状態
    const [previewModal, setPreviewModal] = useState<{
        isOpen: boolean;
        targetIds: string[];
        currentIndex: number;
        data: any | null;
        loading: boolean;
        customOverrides: Record<string, { subject: string; content: string }>;
    }>({
        isOpen: false,
        targetIds: [],
        currentIndex: 0,
        data: null,
        loading: false,
        customOverrides: {}
    });
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
    const [allMembers, setAllMembers] = useState<any[]>([]); // 全受講生マスター
    const [showUnappliedModal, setShowUnappliedModal] = useState(false);
    const [loadingUnapplied, setLoadingUnapplied] = useState(false);

    // 集計除外ラベルがついているメンバーの判定キーセット
    const excludedMemberKeys = useMemo(() => {
        const keys = new Set<string>();
        allMembers.forEach(m => {
            if (m.exclude_from_count) {
                const name = (m.name || '').replace(/[\s\u3000]+/g, '');
                const email = (m.email || '').toLowerCase().trim();
                const key = (name || email) ? `${name}|${email}` : null;
                if (key) keys.add(key);
            }
        });
        return keys;
    }, [allMembers]);

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

                // 集計除外ラベルの人は重複判定から除外
                if (excludedMemberKeys.has(key)) return;

                // 「確認中」タグ、または「確認中（受講生一致エラー）」のものは重複・コンフリクト判定（ハイライト）から除外
                const isKakuninChu = app.tags?.includes('確認中') || (app.applied_rank_name || '').includes('確認中');
                if (isKakuninChu) return;

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

    // 申込統計の計算（受講生マスタ内・外の内訳）
    const dashboardStats = useMemo(() => {
        if (allMembers.length === 0 && apps.length === 0) return null;

        // 申込済みのメンバー特定用
        const appliedMemberIds = new Set<string>();
        const appliedEmails = new Set<string>();
        const uniqueApplicantKeys = new Set<string>();

        apps.forEach(app => {
            if (app.payment_status === 'cancelled') return;

            const name = (app.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (app.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;
            if (key) uniqueApplicantKeys.add(key);

            if (app.matched_member_id) appliedMemberIds.add(String(app.matched_member_id));
            if (app.input_email) appliedEmails.add(app.input_email.toLowerCase().trim());
        });

        // マスタ内の集計
        let masterAppliedCount = 0;
        let masterActiveTotal = 0;
        const registeredApplicantKeys = new Set<string>();

        allMembers.forEach(m => {
            if (m.exclude_from_count) return; // 除外ラベル付きは統計に含めない

            masterActiveTotal++;
            const mId = String(m.id);
            const mEmail = m.email ? m.email.toLowerCase().trim() : '';
            const mName = (m.name || '').replace(/[\s\u3000]+/g, '');

            const hasApplied = appliedMemberIds.has(mId) || (mEmail && appliedEmails.has(mEmail));

            if (hasApplied) {
                masterAppliedCount++;
                const key = (mName || mEmail) ? `${mName}|${mEmail}` : null;
                if (key) registeredApplicantKeys.add(key);
            }
        });

        const masterUnappliedCount = masterActiveTotal - masterAppliedCount;

        // マスタ外の集計
        // uniqueApplicantKeys のうち、registeredApplicantKeys に含まれないものをカウント
        let outsideCount = 0;
        uniqueApplicantKeys.forEach(key => {
            if (!registeredApplicantKeys.has(key)) {
                outsideCount++;
            }
        });

        return {
            masterTotal: masterActiveTotal,
            masterApplied: masterAppliedCount,
            masterUnapplied: masterUnappliedCount,
            outsideApplied: outsideCount,
            totalUnique: uniqueApplicantKeys.size,
            validAppsCount: apps.filter(a => a.payment_status !== 'cancelled').length
        };
    }, [apps, allMembers]);
    const [exportTermLabel, setExportTermLabel] = useState('リピート＆本講座');
    const [exportCampaignLabel, setExportCampaignLabel] = useState('水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介');
    const [exportRemarks, setExportRemarks] = useState('');
    const [exportMonth, setExportMonth] = useState('');
    const [exportPaymentStatus, setExportPaymentStatus] = useState(true);
    const [exportShowRemarks, setExportShowRemarks] = useState(true);
    const [exportShowSocial, setExportShowSocial] = useState(false);

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

        const savedPaymentStatus = localStorage.getItem('shingengaku_export_payment_status');
        if (savedPaymentStatus !== null) setExportPaymentStatus(savedPaymentStatus === 'true');

        const savedShowRemarks = localStorage.getItem('shingengaku_export_show_remarks');
        if (savedShowRemarks !== null) setExportShowRemarks(savedShowRemarks === 'true');

        const savedShowSocial = localStorage.getItem('shingengaku_export_show_social');
        if (savedShowSocial !== null) setExportShowSocial(savedShowSocial === 'true');
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

    useEffect(() => {
        localStorage.setItem('shingengaku_export_payment_status', exportPaymentStatus.toString());
    }, [exportPaymentStatus]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_show_remarks', exportShowRemarks.toString());
    }, [exportShowRemarks]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_show_social', exportShowSocial.toString());
    }, [exportShowSocial]);

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
        fetchAllMembers(); // 全受講生情報を取得（統計・未申込者確認用）
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

    const fetchAllMembers = async () => {
        try {
            const res = await fetch('/api/admin/members', { cache: 'no-store' });
            if (res.ok) {
                const membersData = await res.json();
                setAllMembers(membersData);
            }
        } catch (e) {
            console.error('Error fetching members:', e);
        }
    };

    const fetchUnappliedMembers = async () => {
        setLoadingUnapplied(true);
        setShowUnappliedModal(true);
        try {
            // 常に最新の受講生マスターを取得して最新の除外設定等を反映する
            const res = await fetch('/api/admin/members', { cache: 'no-store' });
            if (!res.ok) throw new Error('受講生マスターの取得に失敗しました');
            const membersData = await res.json();
            setAllMembers(membersData);

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
                // 除外ラベル（exclude_from_count）が付いている場合はリストから完全に除去
                if (member.exclude_from_count || member.exclude_from_count === 1 || member.exclude_from_count === '1' || member.exclude_from_count === 'true') {
                    return false;
                }

                const mId = String(member.id);
                const mEmail = member.email ? member.email.toLowerCase().trim() : '';

                if (appliedMemberIds.has(mId)) return false;
                if (mEmail && appliedEmails.has(mEmail)) return false;
                return true;
            });

            setUnappliedMembers(unapplied);
        } catch (e) {
            console.error('Error fetching unapplied members:', e);
            alert('受講生マスターの取得に失敗しました');
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
            const name = (app.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (app.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;

            // 集計除外ラベルの人は重複判定から除外
            if (key && excludedMemberKeys.has(key)) return;

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
        // キャンセル解除対象のレコードを取得
        const targetApp = apps.find(a => a.id === id);
        if (!targetApp) return;

        // 同一人物のアクティブなレコードが存在するか確認
        const targetName = (targetApp.input_name || '').replace(/[\s\u3000]+/g, '');
        const targetEmail = (targetApp.input_email || '').toLowerCase().trim();
        const hasActiveDuplicate = apps.some(a => {
            if (a.id === id) return false; // 自分自身は除外
            if (a.payment_status === 'cancelled') return false; // キャンセル済みも除外
            const aName = (a.input_name || '').replace(/[\s\u3000]+/g, '');
            const aEmail = (a.input_email || '').toLowerCase().trim();
            return aName === targetName && aEmail === targetEmail;
        });

        if (hasActiveDuplicate) {
            if (!confirm(
                `⚠️ 重複の警告\n\n「${targetApp.input_name}」さんのアクティブな申込レコードが既に存在します。\n\nキャンセルを解除すると重複レコードになりますが、よろしいですか？\n\n（重複レコードはダッシュボード上で「重複」バッジにより確認できます）`
            )) return;
        } else {
            if (!confirm('キャンセルを解除して「未決済」に戻しますか？')) return;
        }

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
                    email: data.email,
                    additionalEmail: data.additional_email || '',
                    sendToOriginal: true
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
                    body: customResendModal.body,
                    additionalEmail: customResendModal.additionalEmail,
                    sendToOriginal: customResendModal.sendToOriginal
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
        
        // 備考欄から「紹介者」を抽出
        const remarksText = app.remarks || '';
        const introMatch = remarksText.match(/紹介者:\s*([^\n]+)/);
        const introducerVal = (introMatch && !introMatch[1].includes('なし') && !introMatch[1].includes('未入力') && !introMatch[1].includes('ありません')) ? introMatch[1].trim() : '';

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
            member_generation: app.members?.generation === 9991 ? '法人' : 
                               app.members?.generation === 9992 ? '経営幹部' : 
                               (app.members?.generation ? String(app.members.generation) : ''),
            cc_email: app.cc_email || adminEmail || '',
            bcc_email: app.bcc_email || adminBccEmail || '',
            participation_type: app.participation_type,
            payment_status: app.payment_status,
            receipt_date: app.tags?.find(t => t.startsWith('rd:'))?.split(':')[1] || '',
            payment_method: app.tags?.find(t => t.startsWith('pm:'))?.split(':')[1] || '',
            introducer: introducerVal
        });
        setShowModal(true);
    };

    const handleOpenLinkModal = () => {
        if (selectedIds.size < 2) {
            alert('合算するには2件以上のお申し込みを選択してください。');
            return;
        }
        const selectedApps = apps.filter(a => selectedIds.has(a.id));
        if (selectedApps.length > 0) {
            setLinkParentId(selectedApps[0].id);
        }
        setShowLinkModal(true);
    };

    const handleLinkApplications = async () => {
        if (!linkParentId) {
            alert('代表者（親）を選択してください。');
            return;
        }
        setLinking(true);
        try {
            const childIds = Array.from(selectedIds).filter(id => id !== linkParentId);
            const res = await fetch('/api/admin/applications/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'link',
                    parent_application_id: linkParentId,
                    child_application_ids: childIds
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('お申し込みを合算しました。');
                setSelectedIds(new Set());
                setShowLinkModal(false);
                fetchApplications();
            } else {
                alert('合算に失敗しました: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました。');
        } finally {
            setLinking(false);
        }
    };

    const handleUnlinkApplications = async () => {
        if (selectedIds.size === 0) {
            alert('解除するお申し込みを選択してください。');
            return;
        }
        if (!confirm(`選択された ${selectedIds.size} 件のお申し込みの合算（紐付け）を解除しますか？`)) {
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'unlink',
                    child_application_ids: Array.from(selectedIds)
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('合算を解除しました。');
                setSelectedIds(new Set());
                fetchApplications();
            } else {
                alert('解除に失敗しました: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました。');
        } finally {
            setLoading(false);
        }
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

                    if (value === 'venue') {
                        next.online_venues = null;
                    } else if (value === 'online') {
                        next.social_venue = 'none';
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

                    if (value === 'venue') {
                        next.online_venues = null;
                    } else if (value === 'online') {
                        next.social_venue = 'none';
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
                payment_status: editForm.payment_status,
                introducer: editForm.introducer || '',
                // タグの構築
                tags: [
                    ...(editingApp.tags || []).filter(t => !t.startsWith('rd:') && !t.startsWith('pm:')),
                    ...(editForm.receipt_date ? [`rd:${editForm.receipt_date}`] : []),
                    ...(editForm.payment_method ? [`pm:${editForm.payment_method}`] : [])
                ]
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

    const resetIssuanceStatus = async () => {
        if (!editingApp || !confirm('この申込の発行状況をリセットして、再発行（ロック解除）を許可しますか？')) return;
        try {
            const newTags = (editingApp.tags || []).filter(t => !t.startsWith('receipted') && !t.startsWith('invoiced'));
            const res = await fetch('/api/admin/applications/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingApp.id,
                    type: 'update',
                    tags: newTags,
                    updated_at: editingApp.updated_at
                }),
            });
            if (res.ok) {
                alert('発行状況をリセットしました。');
                // Update local state to reflect change in modal
                setEditingApp({ ...editingApp, tags: newTags });
                fetchApplications();
            } else {
                alert('リセットに失敗しました。');
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

    const exportCSV = async (useFilter: boolean = true) => {
        // 1. 特進生の全リストを取得して、名前ベースで特進判定を補完する
        const [membersRes, kanjiRes] = await Promise.all([
            fetch('/api/admin/members'),
            fetch('/api/admin/settings/kanji-mapping')
        ]);
        const allMembersData = await membersRes.json();
        const currentKanjiMap = kanjiRes.ok ? await kanjiRes.json() : undefined;

        const tokushinNameSet = new Set(
            allMembersData
                .filter((m: any) => m.is_tokushin)
                .map((m: any) => normalizeName(m.name || '', currentKanjiMap))
        );

        // 除外ラベルのメンバーキーセット作成
        const excludedKeys = new Set(
            allMembersData
                .filter((m: any) => m.exclude_from_count)
                .map((m: any) => {
                    const name = (m.name || '').replace(/[\s\u3000]+/g, '');
                    const email = (m.email || '').toLowerCase().trim();
                    return (name || email) ? `${name}|${email}` : null;
                })
                .filter(Boolean)
        );

        // 全レコードを出力（名寄せしない。除外ラベル付きは飛ばす）
        let targetApps = (useFilter ? [...filteredApps] : [...apps]).filter(app => {
            const name = (app.input_name || '').replace(/[\s\u3000]+/g, '');
            const email = (app.input_email || '').toLowerCase().trim();
            const key = (name || email) ? `${name}|${email}` : null;
            return !key || !excludedKeys.has(key);
        });

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
            const gen = formatGeneration(app.members?.generation) || '-';
            // マスタ重複救済ロジック適用
            const isTokushin = app.members?.is_tokushin || tokushinNameSet.has(normalizeName(app.input_name, currentKanjiMap));
            const tokushin = isTokushin ? '特進' : '';
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

        const formatDateForExcel = (startStr: string) => {
            if (!startStr) return '';
            const start = new Date(startStr);
            if (isNaN(start.getTime())) return startStr;
            return `${start.getDate()}日`;
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

            // 1. 特進生の全リストを取得して、名前ベースで特進判定を補完する
            // 最新の受講生データを特進判定・カウント除外用に軽量フェッチ（常に最新状態を確保）
            const membersRes = await fetch('/api/admin/members?simple=true');
            if (!membersRes.ok) {
                throw new Error(`受講生データの取得に失敗しました (HTTP ${membersRes.status})`);
            }
            const allMembersData = await membersRes.json();
            if (!Array.isArray(allMembersData)) {
                throw new Error('受講生データが配列ではありません。');
            }

            // 漢字マッピング設定のみフェッチ
            const kanjiRes = await fetch('/api/admin/settings/kanji-mapping');
            const currentKanjiMap = kanjiRes.ok ? await kanjiRes.json() : undefined;

            const tokushinNameSet = new Set(
                allMembersData
                    .filter((m: any) => m.is_tokushin)
                    .map((m: any) => normalizeName(m.name || '', currentKanjiMap))
            );

            // メンバーIDから期へのマッピング、およびフォールバック用の名前から期へのマッピング
            const memberIdToGenMap = new Map<number, number>();
            const memberGenerationMap = new Map<string, number>();
            allMembersData.forEach((m: any) => {
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

            // Helper: Find Master-defined group priority (1:Tokushin, 2:Terms, 3:Executive, 4:Referral)
            const getPriorityByMaster = (app: Application) => {
                const rankName = app.applied_rank_name || app.members?.ranks?.name || '';

                // 法人グループ (優先度 6) の追加
                // ※受講生マスタの所属期が「法人コース」である場合のみ優先度6とする。
                // 属性が「初年/法人」であっても、所属期が通常の期生（11期、12期など）の場合は対象外とする。
                const termName = app.members?.terms?.name || '';
                const genVal = app.members?.generation;
                if (termName.includes('法人') || genVal === 9991) {
                    return 6;
                }

                // 1. Tokushin check (Highest Priority)
                if (rankName.includes('特進') || (app.members?.is_tokushin) || tokushinNameSet.has(normalizeName(app.input_name, currentKanjiMap))) return 1;

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

                const isKakuninChu = app.tags?.includes('確認中') || (app.applied_rank_name || '').includes('確認中');
                let name = app.input_name + 'さま';
                if (isKakuninChu) {
                    name += ' (要確認)';
                }
                let introText = '';
                let hasIntroducer = false;

                // 紹介者の抽出 (備考から)
                const remarks = app.remarks || '';
                const introMatch = remarks.match(/紹介者:\s*([^\n]+)/);
                if (introMatch && !introMatch[1].includes('なし') && !introMatch[1].includes('未入力')) {
                    let introName = introMatch[1].trim();
                    // 末尾の「様」「さま」「さん」を一旦削除して、一貫して「さま」を付与する
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
                let term = '';
                const termName = app.members?.terms?.name || '';
                if (termName.includes('法人') || gen === 9991) {
                    term = '法人';
                } else if (termName.includes('経営幹部') || gen === 9992) {
                    term = '経幹';
                } else {
                    term = (gen === 99 || gen === 9999 || gen === 0) ? '' : `${gen}期`;
                }
                const furigana = app.members?.furigana || app.input_furigana || '';

                // 集約ステータスを使用
                // 集約ステータスを使用
                const isBoth = personStatus?.isBoth || false;
                const isHybrid = personStatus?.isHybrid || false;

                const priority = getPriorityByMaster(app);
                const social = app.social_venue ? app.social_venue : (app.attend_social ? '参加' : '参加しない');

                return { name, introText, term, furigana, isBoth, isHybrid, gen, priority, paymentStatus: app.payment_status, hasIntroducer, social };
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
            // 除外ラベル付きもここで弾く
            const excelExcludedKeys = new Set(
                allMembersData
                    .filter((m: any) => m.exclude_from_count)
                    .map((m: any) => {
                        const name = (m.name || '').replace(/[\s\u3000]+/g, '');
                        const email = (m.email || '').toLowerCase().trim();
                        return (name || email) ? `${name}|${email}` : null;
                    })
                    .filter(Boolean)
            );
            const allValidApps = apps.filter(a => {
                if ((a.payment_status || '').toLowerCase() === 'cancelled') return false;
                
                // 不参加・キャンセル・欠席タグのあるデータを除外
                const tags = a.tags || [];
                if (tags.includes('不参加') || tags.includes('キャンセル') || tags.includes('欠席')) return false;

                // 会場が「参加しない」などに設定されているデータを除外
                const venue = (a.venue || '').trim();
                if (venue === '参加しない' || venue === '不参加' || venue === 'キャンセル' || venue === '欠席') return false;

                const name = (a.input_name || '').replace(/[\s\u3000]+/g, '');
                const email = (a.input_email || '').toLowerCase().trim();
                const key = (name || email) ? `${name}|${email}` : null;
                if (key && excelExcludedKeys.has(key)) return false;
                return true;
            });

            // 1. 全申込みの正規化キーと出現場所を把握する
            const getDedupeKey = (a: Application) => `${normalizeName(a.input_name, currentKanjiMap)}|${(a.input_email || '').toLowerCase().trim()}`;

            // 各会場カテゴリへの振り分け (生リスト)
            const listApps = {
                tokyo: [] as Application[],
                fukuoka: [] as Application[],
                onlineTokyo: [] as Application[],
                onlineFukuoka: [] as Application[],
                others: [] as Application[]
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

            // 2. 重複・コンフリクトの検出
            const globalExcludedKeys = new Set<string>();
            const allDupWarnings: any[] = [];
            const venueOnlineConflicts: any[] = [];

            // A. 同一リスト内での重複チェック
            const checkDup = (appList: Application[], label: string) => {
                const counts = new Map<string, Application[]>();
                appList.forEach(a => {
                    // 「確認中」タグ、または「確認中（受講生一致エラー）」のものは重複判定のカウントから除外
                    const isKakuninChu = a.tags?.includes('確認中') || (a.applied_rank_name || '').includes('確認中');
                    if (isKakuninChu) return;

                    const k = getDedupeKey(a);
                    if (!counts.has(k)) counts.set(k, []);
                    counts.get(k)!.push(a);
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

            // B. 会場＋同エリアオンラインのコンフリクトチェック
            const checkConflict = (vApps: Application[], oApps: Application[], area: string) => {
                const isNotKakuninChu = (a: Application) => !(a.tags?.includes('確認中') || (a.applied_rank_name || '').includes('確認中'));
                const vKeys = new Map(vApps.filter(isNotKakuninChu).map(a => [getDedupeKey(a), a]));
                const oKeys = new Map(oApps.filter(isNotKakuninChu).map(a => [getDedupeKey(a), a]));

                vKeys.forEach((vApp, key) => {
                    if (oKeys.has(key)) {
                        globalExcludedKeys.add(key);
                        const oApp = oKeys.get(key)!;
                        // すでに重複警告に出ていない場合のみ追加（二重表示防止）
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

            // 3. 最終的なリスト生成 (グローバル除外を適用して整形)
            const filterAndMap = (list: Application[]) =>
                list.filter(a => !globalExcludedKeys.has(getDedupeKey(a))).map(getMemberInfo);

            const rawTokyo = filterAndMap(listApps.tokyo);
            const rawFukuoka = filterAndMap(listApps.fukuoka);
            const rawOnlineTokyo = filterAndMap(listApps.onlineTokyo);
            const rawOnlineFukuoka = filterAndMap(listApps.onlineFukuoka);
            const rawOthers = filterAndMap(listApps.others);

            // Grouping Helper
            const groupList = (list: any[]) => {
                return {
                    tokushin: list.filter(i => i.priority === 1).sort(sorterTerm),
                    terms: list.filter(i => i.priority === 2).sort(sorterTerm),
                    general: list.filter(i => i.priority === 3).sort(sorterName),
                    executive: list.filter(i => i.priority === 4).sort(sorterName),
                    referral: list.filter(i => i.priority === 5).sort(sorterName),
                    hojin: list.filter(i => i.priority === 6).sort(sorterName)
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



            // Columns configurations (No, Name, Term, Payment?, Social?)
            const colWidths = [4, 20, exportPaymentStatus || exportShowSocial ? 5 : 6];
            if (exportPaymentStatus) colWidths.push(8);
            if (exportShowSocial) colWidths.push(8);
            const colsPerVenue = colWidths.length;
            const spacerWidth = 2;

            const columnsConfig = [];
            for (let i = 0; i < 3; i++) {
                colWidths.forEach(w => columnsConfig.push({ width: w }));
                if (i < 2) columnsConfig.push({ width: spacerWidth });
            }
            ws.columns = columnsConfig;

            // Header Merges based on column count
            const totalCols = (colsPerVenue * 3) + 2; // 3 blocks + 2 spacers
            const getColLetter = (n: number) => String.fromCharCode(65 + n - 1); // 1-indexed to Letter (Simple A-Z)
            const lastColLetter = getColLetter(totalCols);

            // Headers
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

            // Counts Row
            ws.getRow(2).height = 40;

            // Render Headers for Venues (Ordered)
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

            // Render Block Helper
            const renderBlock = (startRow: number, colOffset: number, title: string, data: any[], startSeq: number, isTitleOnly = false, themeColor?: string) => {
                let currentRow = startRow;

                const getBorder = (type: 'all' | 'top-half' | 'bottom-half' = 'all') => {
                    const borderStyle = {
                        style: 'thin' as const,
                        color: { argb: 'FF000000' }
                    };

                    if (type === 'top-half') {
                        return { top: borderStyle, left: borderStyle, right: borderStyle };
                    }
                    if (type === 'bottom-half') {
                        return { bottom: borderStyle, left: borderStyle, right: borderStyle };
                    }
                    return { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
                };

                // Group Title
                const titleCellRef = ws.getRow(currentRow).getCell(colOffset + 1);
                ws.mergeCells(currentRow, colOffset + 1, currentRow, colOffset + colsPerVenue);
                titleCellRef.value = title;
                titleCellRef.alignment = { vertical: 'middle', horizontal: 'center' };

                const currentTitleColor = themeColor || (title.includes('配信分') ? 'FFD9EAD3' : 'FFD3D3D3');
                const finalHeaderColor = (!themeColor && title.includes('東京配信分')) ? 'FFCFE2F3' : currentTitleColor;

                titleCellRef.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: finalHeaderColor }
                };
                titleCellRef.font = { bold: true };
                titleCellRef.border = getBorder();
                currentRow++;

                if (isTitleOnly) return { nextRow: currentRow, nextSeq: startSeq };

                // Headers
                const hRow = ws.getRow(currentRow);
                const headers = ['No', '氏名', '期'];
                if (exportPaymentStatus) headers.push('決済');
                if (exportShowSocial) headers.push('懇親会');
                headers.forEach((h, i) => {
                    const c = hRow.getCell(colOffset + 1 + i);
                    c.value = h;
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                    c.border = getBorder();
                    c.alignment = { horizontal: 'center' };
                });
                currentRow++;

                // Data
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
                    data.forEach((d, idx) => {
                        const statusLabels: Record<string, string> = { paid: '済み', unpaid: '未決済' };

                        if (d.hasIntroducer) {
                            const r1 = ws.getRow(currentRow);
                            const r2 = ws.getRow(currentRow + 1);

                            ws.mergeCells(currentRow, colOffset + 1, currentRow + 1, colOffset + 1);
                            ws.mergeCells(currentRow, colOffset + 3, currentRow + 1, colOffset + 3);

                            let currentMergeCol = 4;
                            if (exportPaymentStatus) {
                                ws.mergeCells(currentRow, colOffset + currentMergeCol, currentRow + 1, colOffset + currentMergeCol);
                                currentMergeCol++;
                            }
                            if (exportShowSocial) {
                                ws.mergeCells(currentRow, colOffset + currentMergeCol, currentRow + 1, colOffset + currentMergeCol);
                                currentMergeCol++;
                            }

                            const c1 = ws.getCell(currentRow, colOffset + 1);
                            const c2_1 = ws.getCell(currentRow, colOffset + 2);
                            const c2_2 = ws.getCell(currentRow + 1, colOffset + 2);
                            const c3 = ws.getCell(currentRow, colOffset + 3);

                            c1.value = currentSeq++;
                            c1.alignment = { horizontal: 'center', vertical: 'middle' };

                            c2_1.value = d.name;
                            c2_1.alignment = { vertical: 'bottom', wrapText: false };

                            c2_2.value = d.introText;
                            c2_2.alignment = { vertical: 'top', wrapText: true };

                            c3.value = d.term;
                            c3.alignment = { horizontal: 'center', vertical: 'middle' };

                            const borderCells = [c1, c3];

                            let currentColIndex = 4;
                            if (exportPaymentStatus) {
                                const cPay = ws.getCell(currentRow, colOffset + currentColIndex);
                                cPay.value = statusLabels[d.paymentStatus] || '';
                                cPay.alignment = { horizontal: 'center', vertical: 'middle' };
                                borderCells.push(cPay);
                                ws.getCell(currentRow + 1, colOffset + currentColIndex).border = getBorder();
                                currentColIndex++;
                            }
                            if (exportShowSocial) {
                                const cSoc = ws.getCell(currentRow, colOffset + currentColIndex);
                                cSoc.value = d.social;
                                cSoc.alignment = { horizontal: 'center', vertical: 'middle' };
                                borderCells.push(cSoc);
                                ws.getCell(currentRow + 1, colOffset + currentColIndex).border = getBorder();
                                currentColIndex++;
                            }

                            borderCells.forEach(c => {
                                c.border = getBorder();
                            });

                            // Borders for name cells (no middle border)
                            c2_1.border = getBorder('top-half');
                            c2_2.border = getBorder('bottom-half');

                            // Highlight 'Both' matches or 'Hybrid'
                            if (d.isBoth) {
                                c2_1.font = { color: { argb: 'FFFF0000' } };
                                c2_2.font = { color: { argb: 'FFFF0000' }, size: 9 };
                            } else if (d.isHybrid) {
                                c2_1.font = { color: { argb: 'FF00B050' } };
                                c2_2.font = { color: { argb: 'FF00B050' }, size: 9 };
                            } else {
                                c2_2.font = { size: 9 };
                            }

                            // Ensure hidden cells in the merge block also have borders
                            ws.getCell(currentRow + 1, colOffset + 1).border = getBorder();
                            ws.getCell(currentRow + 1, colOffset + 3).border = getBorder();

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

                            let currentColIndex = 4;
                            if (exportPaymentStatus) {
                                const cPay = r.getCell(colOffset + currentColIndex);
                                cPay.value = statusLabels[d.paymentStatus] || '';
                                cPay.alignment = { horizontal: 'center', vertical: 'middle' };
                                borderCells.push(cPay);
                                currentColIndex++;
                            }
                            if (exportShowSocial) {
                                const cSoc = r.getCell(colOffset + currentColIndex);
                                cSoc.value = d.social;
                                cSoc.alignment = { horizontal: 'center', vertical: 'middle' };
                                borderCells.push(cSoc);
                                currentColIndex++;
                            }

                            borderCells.forEach(c => {
                                c.border = getBorder();
                            });

                            if (d.isBoth) {
                                c2.font = { color: { argb: 'FFFF0000' } };
                            } else if (d.isHybrid) {
                                c2.font = { color: { argb: 'FF00B050' } };
                            }
                            currentRow++;
                        }
                    });
                }

                return { nextRow: currentRow, nextSeq: currentSeq };
            };

            const startRow = 4;
            let maxRow = 4;

            // Render Real Venues (Tokyo/Fukuoka in determined order)
            venueOrder.forEach((v, idx) => {
                const colOffset = idx * (colsPerVenue + 1);
                let rV = startRow;
                let seqV = 1;
                let resV = renderBlock(rV, colOffset, '特進', v.groups.tokushin, seqV);
                rV = resV.nextRow + 1; seqV = resV.nextSeq;

                resV = renderBlock(rV, colOffset, exportTermLabel || 'リピート＆本講座', v.groups.terms, seqV);
                rV = resV.nextRow + 1; seqV = resV.nextSeq;

                resV = renderBlock(rV, colOffset, '法人', v.groups.hojin, seqV);
                rV = resV.nextRow + 1; seqV = resV.nextSeq;

                resV = renderBlock(rV, colOffset, '一般 (未受講)', v.groups.general, seqV);
                rV = resV.nextRow + 1; seqV = resV.nextSeq;

                resV = renderBlock(rV, colOffset, '経営幹部', v.groups.executive, seqV);
                rV = resV.nextRow + 1; seqV = resV.nextSeq;

                resV = renderBlock(rV, colOffset, exportCampaignLabel || '水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介', v.groups.referral, seqV);
                rV = resV.nextRow;

                if (rV > maxRow) maxRow = rV;
            });

            // Online Render (Ordered sub-sections)
            let rO = startRow;
            let seqO = 1;
            const onlineColOffset = 2 * (colsPerVenue + 1);

            onlineOrder.forEach((o, idx) => {
                const theme = o.title.includes('東京配信分') ? 'FFCFE2F3' :
                    o.title.includes('福岡配信分') ? 'FFD9EAD3' : undefined;

                // Header for sub-section
                let resO = renderBlock(rO, onlineColOffset, o.title, [], 0, true, theme);
                rO = resO.nextRow;

                if (o.list.length > 0) {
                    resO = renderBlock(rO, onlineColOffset, '特進', o.groups.tokushin, seqO, false, theme);
                    rO = resO.nextRow + 1; seqO = resO.nextSeq;
                    resO = renderBlock(rO, onlineColOffset, exportTermLabel || 'リピート＆本講座', o.groups.terms, seqO, false, theme);
                    rO = resO.nextRow + 1; seqO = resO.nextSeq;
                    resO = renderBlock(rO, onlineColOffset, '法人', o.groups.hojin, seqO, false, theme);
                    rO = resO.nextRow + 1; seqO = resO.nextSeq;
                    resO = renderBlock(rO, onlineColOffset, '一般 (未受講)', o.groups.general, seqO, false, theme);
                    rO = resO.nextRow + 1; seqO = resO.nextSeq;
                    resO = renderBlock(rO, onlineColOffset, '経営幹部', o.groups.executive, seqO, false, theme);
                    rO = resO.nextRow + 1; seqO = resO.nextSeq;
                    resO = renderBlock(rO, onlineColOffset, exportCampaignLabel || '水無月のご縁ｷｬﾝﾍﾟｰﾝ ご紹介', o.groups.referral, seqO, false, theme);
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

            // ============================================================
            // 欄外：除外者一覧テーブル
            // ============================================================
            const hasAnyExclusion = allDupWarnings.length > 0 || venueOnlineConflicts.length > 0;
            if (hasAnyExclusion) {
                // セクションタイトル
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

                // テーブルヘッダー
                const tblHeaderRow = secRow + 1;
                const tblHeaders = ['除外理由', '氏名', '申込①内容', '申込②内容'];

                // 配分を totalCols (11 or 14) に合わせる
                let tblColWidths: number[];
                if (totalCols === 14) {
                    tblColWidths = [2, 4, 4, 4]; // 合計 14 (A-B:理由, C-F:氏名, G-J:内容1, K-N:内容2)
                } else {
                    tblColWidths = [2, 3, 3, 3]; // 合計 11
                }

                const tblHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF990000' } };
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

                // データ行ヘルパー
                let dataRow = tblHeaderRow + 1;
                const fillYellow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF8E1' } };
                const fillOrange = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF3E0' } };
                const thinBorder = { style: 'thin' as const };
                const cellBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

                const writeDataRow = (cols: string[], fill: typeof fillYellow) => {
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

                // ① 同一リスト重複（黄色）
                allDupWarnings.forEach(w => {
                    // 除外されたappsの申込内容を整形（最大2件まで表形式で）
                    const apps1 = w.excludedApps[0];
                    const apps2 = w.excludedApps[1];
                    const fmt = (a?: Application) => a
                        ? `${a.venue || ''}${a.participation_type === 'online' ? '（オンライン）' : '（会場）'} / ${a.applied_rank_name || ''}`
                        : '';
                    writeDataRow([
                        `同一${w.venue}に重複申込`,
                        `${w.name}さま`,
                        fmt(apps1),
                        fmt(apps2)
                    ], fillYellow);
                });

                // ② 会場＋同エリアオンライン重複（オレンジ）
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
            const blob = new Blob([buf], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simple_participants_${monthStr}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();

        } catch (e: any) {
            console.error(e);
            alert('エクセル生成エラー: ' + (e?.message || e || '不明なエラー'));
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
            const allValidApps = apps.filter(a => {
                if ((a.payment_status || '').toLowerCase() === 'cancelled') return false;
                
                // 不参加・キャンセル・欠席タグのあるデータを除外
                const tags = a.tags || [];
                if (tags.includes('不参加') || tags.includes('キャンセル') || tags.includes('欠席')) return false;

                // 会場が「参加しない」などに設定されているデータを除外
                const venue = (a.venue || '').trim();
                if (venue === '参加しない' || venue === '不参加' || venue === 'キャンセル' || venue === '欠席') return false;

                return true;
            });

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
                    const gen = formatGeneration(app.members?.generation) || '-';
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

        // 認証入力モーダルを表示して、第一のロックを開始
        setAuthUsername('');
        setAuthPassword('');
        setAuthError('');
        setShowTruncateAuthModal(true);
    };

    const handleVerifyAndTruncate = async () => {
        if (!authUsername || !authPassword) {
            setAuthError('ユーザーIDとパスワードを入力してください');
            return;
        }

        setAuthVerifying(true);
        setAuthError('');

        try {
            // 認証情報を検証（クッキーの設定等は行わない専用API）
            const authRes = await fetch('/api/admin/verify-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: authUsername, password: authPassword })
            });

            if (!authRes.ok) {
                const data = await authRes.json();
                setAuthError(data.error || 'ユーザーIDまたはパスワードが間違っています');
                setAuthVerifying(false);
                return;
            }

            // 認証成功したらモーダルを閉じる
            setShowTruncateAuthModal(false);

            // 第二のロック：最終確認ダイアログ
            if (!confirm('【最重要・二重確認】本当に消していいですか？\n（申込者データがすべて削除され、元に戻せなくなります）')) {
                return;
            }

            // データ削除処理を実行
            setLoading(true);
            const res = await fetch('/api/admin/applications/truncate', { method: 'POST' });
            if (res.ok) {
                alert('全データを削除しました');
                fetchApplications();
            } else {
                const data = await res.json();
                alert(`削除に失敗しました: ${data.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert('通信エラーが発生しました');
        } finally {
            setAuthVerifying(false);
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

    const fetchPreviewData = async (targetIds: string[], index: number) => {
        setPreviewModal(prev => ({ ...prev, currentIndex: index, loading: true, data: null }));
        try {
            const res = await fetch('/api/admin/reminders/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: targetIds[index] }),
            });
            const data = await res.json();
            // 既に手動編集されている場合は、その内容をプレビューデータに反映する
            setPreviewModal(prev => {
                const override = prev.customOverrides[targetIds[index]];
                if (override) {
                    return { ...prev, data: { ...data, subject: override.subject, content: override.content }, loading: false };
                }
                return { ...prev, data, loading: false };
            });
        } catch (e) {
            setPreviewModal(prev => ({ ...prev, data: { error: 'プレビュー取得エラー', isError: true }, loading: false }));
        }
    };

    const handleSendReminders = () => {
        const targetIds = Array.from(selectedIds).filter(id => {
            const app = apps.find(a => a.id === id);
            return app && app.payment_status !== 'cancelled';
        });

        if (targetIds.length === 0) {
            alert('送信対象となる（キャンセルされていない）データがありません。');
            return;
        }

        setPreviewModal({
            isOpen: true,
            targetIds,
            currentIndex: 0,
            data: null,
            loading: true,
            customOverrides: {}
        });
        fetchPreviewData(targetIds, 0);
    };

    const submitReminders = async () => {
        if (!confirm('選択した参加者にリマインドメールを一括送信しますか？')) return;

        const targetIds = previewModal.targetIds;

        if (targetIds.length === 0) {
            alert('送信対象となる（キャンセルされていない）データがありません。');
            return;
        }

        setReminderSending(true);
        try {
            const res = await fetch('/api/admin/reminders/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: targetIds, customOverrides: previewModal.customOverrides })
            });

            if (res.ok) {
                alert('送信を開始しました。一括処理のため完了まで数分かかる場合があります。送信済みのデータには「reminder_sent」タグが付与されます。');
                setPreviewModal(prev => ({ ...prev, isOpen: false }));
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
            const isAlert = (app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert'))
                || (app.applied_rank_name?.startsWith('確認中'));
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
        if (filter !== 'all') {
            const isAlert = (app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert'))
                || (app.applied_rank_name?.startsWith('確認中'));
            const isNotRequired = app.total_amount === 0 && !isAlert && app.payment_status !== 'cancelled';

            if (filter === 'not_required') {
                if (!isNotRequired) return false;
            } else if (filter === 'unpaid') {
                if (app.payment_status !== 'unpaid' || isNotRequired) return false;
            } else if (app.payment_status !== filter) {
                return false;
            }
        }

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
                    <h1 className='text-2xl font-bold text-gray-800'>神言学 管理ダッシュボード (v1.6)</h1>
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
                            <button onClick={() => setFilter('not_required')} className={`px-4 py-2 rounded-md ${filter === 'not_required' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>決済不要</button>
                            <button onClick={() => setFilter('paid')} className={`px-4 py-2 rounded-md ${filter === 'paid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>決済済</button>
                            <button onClick={() => setFilter('cancelled')} className={`px-4 py-2 rounded-md ${filter === 'cancelled' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>キャンセル</button>
                            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>全て</button>
                            <div className="w-px bg-gray-300 h-8 mx-2"></div>
                            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-md bg-green-600 text-white font-bold hover:bg-green-700">新規登録</button>
                            <button onClick={fetchUnappliedMembers} className="px-4 py-2 rounded-md bg-yellow-500 text-white font-bold hover:bg-yellow-600 ml-2">未申込者を確認</button>
                            <span className="ml-4 text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">System Logic v2.5</span>
                        </div>
                        {/* 統計表示 */}
                        <div className="flex gap-4 items-stretch bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
                            {/* マスタ内状況 */}
                            <div className="flex items-center gap-3 px-3 py-1 border-r border-gray-100 last:border-0">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">受講生マスタ ({dashboardStats?.masterTotal || 0}名)</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-black text-gray-900 leading-none">{dashboardStats?.masterApplied || 0}</span>
                                        <span className="text-[10px] font-bold text-gray-400">申込済</span>
                                        <span className="text-lg font-black text-red-600 leading-none ml-2">{dashboardStats?.masterUnapplied || 0}</span>
                                        <span className="text-[10px] font-bold text-red-400">未申込</span>
                                    </div>
                                </div>
                            </div>

                            {/* 実申込者数内訳 */}
                            <div className="flex items-center gap-3 px-3 py-1 border-r border-gray-100 last:border-0">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">総お申込者数 (名寄せ実数)</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xl font-black text-indigo-600 leading-none">{dashboardStats?.totalUnique || 0}</span>
                                        <span className="text-[10px] font-bold text-indigo-400">名</span>
                                        <span className="text-[10px] text-gray-500 ml-2 font-medium">
                                            内訳: マスタ内 <span className="font-bold text-gray-800">{dashboardStats?.masterApplied || 0}</span> / マスタ外 <span className="font-bold text-gray-800">{dashboardStats?.outsideApplied || 0}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 px-4 py-1 bg-gray-50 rounded-md ml-1">
                                <div className="flex flex-col items-center">
                                    <span className='text-[9px] text-gray-400 font-bold uppercase'>未決済</span>
                                    <span className="font-bold text-red-600 text-sm leading-tight">{apps.filter(a => a.payment_status === 'unpaid' && !(a.total_amount === 0 && !(a.remarks?.includes('商品マスタ') && !a.tags?.includes('confirmed_product_alert')))).length}</span>
                                </div>
                                <div className="w-px bg-gray-200 h-6"></div>
                                <div className="flex flex-col items-center">
                                    <span className='text-[9px] text-gray-400 font-bold uppercase'>決済済</span>
                                    <span className="font-bold text-green-600 text-sm leading-tight">{apps.filter(a => a.payment_status === 'paid').length}</span>
                                </div>
                                <div className="w-px bg-gray-200 h-6"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase">総数</span>
                                    <span className="font-bold text-gray-500 text-sm leading-tight">{apps.length}</span>
                                </div>
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
                                                setLectureDates({ ...lectureDates, tokyo: `${e.target.value}T${time}` });
                                            }}
                                        />
                                        <DrumTimePicker
                                            value={lectureDates['tokyo'] || ''}
                                            onChange={(val) => setLectureDates({ ...lectureDates, tokyo: val })}
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
                                                setLectureEndDates({ ...lectureEndDates, tokyo: `${e.target.value}T${time}` });
                                            }}
                                        />
                                        <DrumTimePicker
                                            value={lectureEndDates['tokyo'] || ''}
                                            onChange={(val) => setLectureEndDates({ ...lectureEndDates, tokyo: val })}
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
                                                setLectureDates({ ...lectureDates, fukuoka: `${e.target.value}T${time}` });
                                            }}
                                        />
                                        <DrumTimePicker
                                            value={lectureDates['fukuoka'] || ''}
                                            onChange={(val) => setLectureDates({ ...lectureDates, fukuoka: val })}
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
                                                setLectureEndDates({ ...lectureEndDates, fukuoka: `${e.target.value}T${time}` });
                                            }}
                                        />
                                        <DrumTimePicker
                                            value={lectureEndDates['fukuoka'] || ''}
                                            onChange={(val) => setLectureEndDates({ ...lectureEndDates, fukuoka: val })}
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
                            <div className="flex flex-wrap items-center gap-3 mb-2 bg-gray-50 p-2 rounded border border-gray-200">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                        checked={exportPaymentStatus}
                                        onChange={(e) => setExportPaymentStatus(e.target.checked)}
                                    />
                                    <span className="text-xs font-medium text-gray-700">決済状況</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                        checked={exportShowSocial}
                                        onChange={(e) => setExportShowSocial(e.target.checked)}
                                    />
                                    <span className="text-xs font-medium text-gray-700">懇親会</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                        checked={exportShowRemarks}
                                        onChange={(e) => setExportShowRemarks(e.target.checked)}
                                    />
                                    <span className="text-xs font-medium text-gray-700">備考欄</span>
                                </label>
                            </div>
                            <div className="w-full mb-2">
                                <textarea
                                    placeholder="エクセル用備考 (下部に表示されます)"
                                    className="border rounded px-2 py-1 text-xs w-full h-16 resize-none bg-white hover:border-indigo-400 transition-colors"
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

                    {/* フィルタ状態バナー + データリセットボタン */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                        <div className="flex-1">
                            {(() => {
                                const hasActiveFilters = filter !== 'all' || searchQuery ||
                                    filterRank.size > 0 || filterGen.size > 0 || filterProduct.size > 0 ||
                                    filterVenueLecture.size > 0 || filterVenueSocial.size > 0 ||
                                    filterOnlineOption.size > 0 || filterOnlineArea.size > 0;
                                if (!hasActiveFilters) return null;
                                return (
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm animate-pulse">
                                            <span className="text-red-500">🔴</span>
                                            フィルタ適用中
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            全 <span className="font-bold text-gray-800">{apps.length}</span> 件中
                                            <span className="font-black text-indigo-600 mx-1">{filteredApps.length}</span>件を表示
                                        </span>
                                        <button
                                            onClick={() => {
                                                setFilter('all');
                                                setSearchQuery('');
                                                setFilterRank(new Set());
                                                setFilterGen(new Set());
                                                setFilterProduct(new Set());
                                                setFilterVenueLecture(new Set());
                                                setFilterVenueSocial(new Set());
                                                setFilterOnlineOption(new Set());
                                                setFilterOnlineArea(new Set());
                                            }}
                                            className="text-xs text-red-600 hover:text-red-800 underline font-bold"
                                        >
                                            全てのフィルタを解除
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
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
                                <button onClick={handleOpenLinkModal} className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 ml-4 font-bold shadow-md">
                                    お申し込みを合算する ({selectedIds.size}件)
                                </button>
                                <button onClick={handleUnlinkApplications} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 ml-2 font-bold shadow-md">
                                    合算解除する ({selectedIds.size}件)
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
                                const gen = formatGeneration(app.members?.generation);
                                const furigana = app.members?.furigana || app.input_furigana;

                                const isAlert = (app.remarks?.includes('商品マスタ') && !app.tags?.includes('confirmed_product_alert'))
                                    || (app.applied_rank_name?.startsWith('確認中'));
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

                                const isParent = apps.some(a => a.parent_application_id === app.id);
                                const isChild = !!app.parent_application_id;
                                const parentApp = isChild ? apps.find(a => a.id === app.parent_application_id) : null;

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
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${app.payment_status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
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
                                                {isParent && (
                                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800" title="他の同行者の決済情報と紐付いています">
                                                        代表者
                                                    </span>
                                                )}
                                                {isChild && (
                                                    <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-1">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800" title="代表者のお支払い状況と同期しています">
                                                            同行者
                                                        </span>
                                                        {parentApp && (
                                                            <span>(代表: {parentApp.input_name})</span>
                                                        )}
                                                    </div>
                                                )}
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
                                                {app.tags?.includes('確認中') && (
                                                    <div className="mt-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                                                            🔍 お申込みデータ確認中
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

                                                    // 確認中（受講生一致エラー等）は金額確定前なので比較しない
                                                    if (isMismatched && isAlert) isMismatched = false;

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
                                                <button onClick={() => window.open(`/receipt/${app.id}?admin=true`, '_blank')} className="text-teal-600 hover:text-teal-900 text-xs text-left block w-full">📄 領収書 プレビュー</button>
                                                <button onClick={() => window.open(`/receipt/${app.id}?admin=true&type=invoice`, '_blank')} className="text-sky-600 hover:text-sky-900 text-xs text-left block w-full">📄 請求書 プレビュー</button>
                                            </div>
                                            <div className="pt-1 border-t border-gray-100 mt-1 space-y-1">
                                                <button
                                                    onClick={async () => {
                                                        const currentTags = app.tags || [];
                                                        const hasTag = currentTags.includes('確認中');
                                                        const newTags = hasTag
                                                            ? currentTags.filter(t => t !== '確認中')
                                                            : [...currentTags, '確認中'];
                                                        try {
                                                            const res = await fetch('/api/admin/applications/update', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ ids: [app.id], tags: newTags }),
                                                            });
                                                            if (res.ok) fetchApplications();
                                                            else alert('更新に失敗しました');
                                                        } catch (e) { alert('エラーが発生しました'); }
                                                    }}
                                                    className={`text-xs text-left block w-full ${app.tags?.includes('確認中') ? 'text-amber-600 hover:text-amber-800 font-bold' : 'text-gray-500 hover:text-amber-600'}`}
                                                >
                                                    {app.tags?.includes('確認中') ? '✅ 確認中を解除' : '🔍 確認中にする'}
                                                </button>
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
                                            type="text"
                                            className="border w-full p-2 rounded"
                                            value={editForm.member_generation || ''}
                                            onChange={e => setEditForm({ ...editForm, member_generation: e.target.value })}
                                            placeholder="例: 11、法人、経営幹部"
                                        />
                                    </div>
                                </div>

                                {/* 紹介者入力欄 (一般のみ) */}
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-gray-700 text-indigo-800">紹介者 (一般お申し込みのみ有効)</label>
                                    <input
                                        type="text"
                                        className="border w-full p-2 rounded border-indigo-200 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/30"
                                        value={(editForm as any).introducer || ''}
                                        onChange={e => setEditForm({ ...editForm, introducer: e.target.value })}
                                        placeholder="紹介者の氏名を入力 (例: 山田 太郎)"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        ※紹介者が入力されると、属性が「神言学未受講（ご紹介）」になり、該当する紹介料金へ自動で再計算されます（空にすると「一般」に戻ります）。
                                    </p>
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
                                            {/* 現在の値が通常ランク一覧にない場合（「確認中」等）は選択肢として追加 */}
                                            {editForm.applied_rank_name && !ranks.some(r => r.name === editForm.applied_rank_name) && (
                                                <option value={editForm.applied_rank_name}>{editForm.applied_rank_name}</option>
                                            )}
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">領収日 (書類発行用)</label>
                                        <input
                                            type="date"
                                            className="border w-full p-2 rounded"
                                            value={editForm.receipt_date || ''}
                                            onChange={e => setEditForm({ ...editForm, receipt_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">お支払い方法</label>
                                        <select
                                            className="border w-full p-2 rounded bg-white"
                                            value={editForm.payment_method || ''}
                                            onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })}
                                        >
                                            <option value="">(未選択)</option>
                                            <option value="銀行振込">銀行振込</option>
                                            <option value="クレジットカード">クレジットカード</option>
                                            <option value="現金">現金</option>
                                        </select>
                                    </div>
                                </div>

                                {editingApp && (editingApp.tags || []).some(t => t.startsWith('receipted') || t.startsWith('invoiced')) && (
                                    <div className="bg-amber-50 p-3 rounded border border-amber-200 flex justify-between items-center">
                                        <div>
                                            <p className="text-xs font-bold text-amber-800">書類発行済み（ユーザー側はロック中）</p>
                                            <p className="text-[10px] text-amber-600">再発行を許可するには右のボタンでリセットしてください。</p>
                                        </div>
                                        <button
                                            onClick={resetIssuanceStatus}
                                            className="bg-amber-600 text-white text-[10px] px-3 py-1.5 rounded font-bold hover:bg-amber-700 transition-colors shadow-sm"
                                        >
                                            発行状況リセット
                                        </button>
                                    </div>
                                )}

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

            {/* Link Applications Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[550px] flex flex-col">
                        <h3 className="text-lg font-bold mb-3 text-indigo-700">お申し込みの合算</h3>
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 rounded-r shadow-sm">
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <span className="font-bold">💡 お申し込み合算について</span><br />
                                選択されたお申し込みを親子関係（代表者と同行者）として紐付けます。<br />
                                お支払いは代表者が一括して行う形になり、同行者の決済状況やキャンセル状態は代表者のものと同期されます。
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">代表者（お支払いを行う方）を選択してください：</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded bg-gray-50">
                                {apps.filter(a => selectedIds.has(a.id)).map(app => (
                                    <label key={app.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-100 rounded">
                                        <input
                                            type="radio"
                                            name="linkParent"
                                            checked={linkParentId === app.id}
                                            onChange={() => setLinkParentId(app.id)}
                                            className="h-4 w-4 text-indigo-600 focus:ring-0"
                                        />
                                        <span className="text-sm font-medium text-gray-800">
                                            {app.input_name} ({app.input_email || 'Emailなし'}) - {app.applied_rank_name || '一般'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">同行者（代表者に紐付けられるお申し込み）：</label>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto border p-2 rounded bg-gray-50">
                                {apps.filter(a => selectedIds.has(a.id) && a.id !== linkParentId).length === 0 ? (
                                    <span className="text-xs text-gray-400">（なし）</span>
                                ) : (
                                    apps.filter(a => selectedIds.has(a.id) && a.id !== linkParentId).map(app => (
                                        <div key={app.id} className="text-xs text-gray-600 pl-2">
                                            ・{app.input_name} ({app.applied_rank_name || '一般'})
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setShowLinkModal(false)}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm font-medium text-gray-800"
                                disabled={linking}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleLinkApplications}
                                className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 text-sm font-bold shadow-sm"
                                disabled={linking}
                            >
                                {linking ? '処理中...' : '合算を実行'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
                        <h3 className="text-lg font-bold mb-3 text-indigo-700 flex items-center gap-2 border-b pb-2">
                            <span>✉️</span> 再送メールの編集
                        </h3>

                        {/* Scrollable Form Content */}
                        <div className="flex-1 overflow-y-auto pr-1 mb-4 space-y-4 min-h-0">
                            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded shadow-sm">
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    <span className="font-bold">⚠️ 注意事項</span><br />
                                    ここでの修正内容は、<span className="font-bold">今回の送信にのみ</span>反映されます。<br />
                                    申込者データやオリジナルのテンプレートには保存・反映されませんので、安心して調整してください。
                                </p>
                            </div>

                            <p className="text-sm text-gray-600">内容を編集して「送信」ボタンを押してください。</p>

                            <div className="p-3 bg-gray-50 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-gray-700">元の送信先</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={customResendModal.sendToOriginal}
                                            onChange={e => setCustomResendModal({ ...customResendModal, sendToOriginal: e.target.checked })}
                                            className="h-4 w-4 text-indigo-600 rounded"
                                        />
                                        <span className="text-xs text-gray-600">このアドレスにも送信する</span>
                                    </label>
                                </div>
                                <div className={`text-sm font-mono px-2 py-1.5 rounded ${customResendModal.sendToOriginal ? 'bg-white text-gray-800 border' : 'bg-gray-200 text-gray-400 line-through'}`}>
                                    {customResendModal.email}
                                </div>
                            </div>

                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                <label className="block text-sm font-bold text-indigo-700 mb-1">追加送信先メールアドレス</label>
                                <input
                                    className="border w-full p-2 rounded text-sm bg-white"
                                    type="email"
                                    value={customResendModal.additionalEmail}
                                    onChange={e => setCustomResendModal({ ...customResendModal, additionalEmail: e.target.value })}
                                    placeholder="例: sub-address@example.com"
                                />
                                <p className="text-xs text-indigo-500 mt-1">
                                    ※ 入力したアドレスは保存され、次回再送時にも表示されます
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">件名</label>
                                <input
                                    className="border w-full p-2 rounded text-sm"
                                    value={customResendModal.subject}
                                    onChange={e => setCustomResendModal({ ...customResendModal, subject: e.target.value })}
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="block text-sm font-bold text-gray-700 mb-1">本文</label>
                                <textarea
                                    className="border w-full p-2 rounded font-mono text-sm resize-y min-h-[220px]"
                                    rows={10}
                                    value={customResendModal.body}
                                    onChange={e => setCustomResendModal({ ...customResendModal, body: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Fixed Footer */}
                        <div className="pt-3 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setCustomResendModal({ ...customResendModal, isOpen: false })}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={submitCustomResend}
                                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold text-sm"
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
                                                                    setLectureDates({ ...lectureDates, [area]: `${e.target.value}T${time}` });
                                                                }}
                                                            />
                                                            <DrumTimePicker
                                                                value={lectureDates[area] || ''}
                                                                onChange={val => setLectureDates({ ...lectureDates, [area]: val })}
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
                                                                    setLectureEndDates({ ...lectureEndDates, [area]: `${e.target.value}T${time}` });
                                                                }}
                                                            />
                                                            <DrumTimePicker
                                                                value={lectureEndDates[area] || ''}
                                                                onChange={val => setLectureEndDates({ ...lectureEndDates, [area]: val })}
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
                                                        onChange={e => setOnlineViewingLinks({ ...onlineViewingLinks, [area]: e.target.value })}
                                                    />
                                                    <label className="block text-[10px] text-gray-500">ZOOM ID ({"{{zoom_id}}"}変数用)</label>
                                                    <input
                                                        className="border w-full p-2 rounded text-sm mb-2"
                                                        value={zoomIds[area] || ''}
                                                        placeholder="123 456 7890"
                                                        onChange={e => setZoomIds({ ...zoomIds, [area]: e.target.value })}
                                                    />
                                                    <label className="block text-[10px] text-gray-500">パスワード ({"{{zoom_pass}}"}変数用)</label>
                                                    <input
                                                        className="border w-full p-2 rounded text-sm"
                                                        value={zoomPasses[area] || ''}
                                                        placeholder="password123"
                                                        onChange={e => setZoomPasses({ ...zoomPasses, [area]: e.target.value })}
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
                                                        onChange={e => setEmailTemplateReminderVenuePaid(prev => ({ ...(prev || { subject: '', body: '' }), subject: e.target.value }))}
                                                    />
                                                    <textarea
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs"
                                                        value={emailTemplateReminderVenuePaid?.body || ''}
                                                        onChange={e => setEmailTemplateReminderVenuePaid(prev => ({ ...(prev || { subject: '', body: '' }), body: e.target.value }))}
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderVenuePaid(DEFAULT_TEMPLATE_REMINDER_VENUE_PAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">会場参加・未決済用</label>
                                                    <input
                                                        className="border w-full p-1 rounded text-sm mb-1"
                                                        value={emailTemplateReminderVenueUnpaid?.subject || ''}
                                                        onChange={e => setEmailTemplateReminderVenueUnpaid(prev => ({ ...(prev || { subject: '', body: '' }), subject: e.target.value }))}
                                                    />
                                                    <textarea
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs"
                                                        value={emailTemplateReminderVenueUnpaid?.body || ''}
                                                        onChange={e => setEmailTemplateReminderVenueUnpaid(prev => ({ ...(prev || { subject: '', body: '' }), body: e.target.value }))}
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
                                                        onChange={e => setEmailTemplateReminderOnlinePaid(prev => ({ ...(prev || { subject: '', body: '' }), subject: e.target.value }))}
                                                    />
                                                    <textarea
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs"
                                                        value={emailTemplateReminderOnlinePaid?.body || ''}
                                                        onChange={e => setEmailTemplateReminderOnlinePaid(prev => ({ ...(prev || { subject: '', body: '' }), body: e.target.value }))}
                                                    />
                                                    <button onClick={() => setEmailTemplateReminderOnlinePaid(DEFAULT_TEMPLATE_REMINDER_ONLINE_PAID)} className="text-[10px] text-blue-600 hover:underline mt-1">デフォルトに戻す</button>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">ライブ視聴・未決済用</label>
                                                    <input
                                                        className="border w-full p-1 rounded text-sm mb-1"
                                                        value={emailTemplateReminderOnlineUnpaid?.subject || ''}
                                                        onChange={e => setEmailTemplateReminderOnlineUnpaid(prev => ({ ...(prev || { subject: '', body: '' }), subject: e.target.value }))}
                                                    />
                                                    <textarea
                                                        className="border w-full p-2 rounded h-32 font-mono text-xs"
                                                        value={emailTemplateReminderOnlineUnpaid?.body || ''}
                                                        onChange={e => setEmailTemplateReminderOnlineUnpaid(prev => ({ ...(prev || { subject: '', body: '' }), body: e.target.value }))}
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

            {/* Reminder Preview Modal */}
            {previewModal.isOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
                            <span>🚀</span> 一括リマインド送信の確認
                        </h3>
                        
                        <div className="mb-4 text-sm text-gray-600 flex justify-between items-center bg-gray-50 p-2 rounded border">
                            <span>送信対象: <strong className="text-indigo-600">{previewModal.targetIds.length}</strong> 件</span>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => fetchPreviewData(previewModal.targetIds, previewModal.currentIndex - 1)}
                                    disabled={previewModal.currentIndex === 0 || previewModal.loading}
                                    className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                                >
                                    ◀ 前へ
                                </button>
                                <span className="font-bold text-gray-700 w-16 text-center">{previewModal.currentIndex + 1} / {previewModal.targetIds.length}</span>
                                <button 
                                    onClick={() => fetchPreviewData(previewModal.targetIds, previewModal.currentIndex + 1)}
                                    disabled={previewModal.currentIndex === previewModal.targetIds.length - 1 || previewModal.loading}
                                    className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                                >
                                    次へ ▶
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 border rounded p-4 bg-gray-50 relative min-h-[300px]">
                            {previewModal.loading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : previewModal.data ? (
                                <>
                                    {previewModal.data.isError && (
                                        <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-bold border border-red-200 shadow-sm flex items-start gap-2">
                                            <span>⚠️</span>
                                            <div>
                                                {previewModal.data.error}
                                                <div className="text-xs font-normal mt-1 text-red-600">この参加者は送信対象からスキップされます。</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mb-3 border-b pb-2">
                                        <div className="text-xs text-gray-500 font-bold mb-1">送信先:</div>
                                        <div className="text-sm font-mono text-gray-800">{previewModal.data.email}</div>
                                    </div>
                                    <div className="mb-3 border-b pb-2">
                                        <div className="text-xs text-gray-500 font-bold mb-1 flex items-center gap-2">
                                            件名:
                                            {previewModal.customOverrides[previewModal.targetIds[previewModal.currentIndex]] && (
                                                <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">✏️ 編集済み</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                            value={previewModal.data.subject || ''}
                                            onChange={(e) => {
                                                const currentId = previewModal.targetIds[previewModal.currentIndex];
                                                const currentContent = previewModal.data?.content || '';
                                                setPreviewModal(prev => ({
                                                    ...prev,
                                                    data: { ...prev.data, subject: e.target.value },
                                                    customOverrides: {
                                                        ...prev.customOverrides,
                                                        [currentId]: { subject: e.target.value, content: prev.customOverrides[currentId]?.content || currentContent }
                                                    }
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <div className="text-xs text-gray-500 font-bold mb-1">本文:</div>
                                        <textarea
                                            className="w-full flex-1 border rounded p-3 text-sm font-sans text-gray-700 font-medium leading-relaxed bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[300px] resize-y"
                                            value={previewModal.data.content || ''}
                                            onChange={(e) => {
                                                const currentId = previewModal.targetIds[previewModal.currentIndex];
                                                const currentSubject = previewModal.data?.subject || '';
                                                setPreviewModal(prev => ({
                                                    ...prev,
                                                    data: { ...prev.data, content: e.target.value },
                                                    customOverrides: {
                                                        ...prev.customOverrides,
                                                        [currentId]: { subject: prev.customOverrides[currentId]?.subject || currentSubject, content: e.target.value }
                                                    }
                                                }));
                                            }}
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                onClick={() => setPreviewModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 font-bold"
                                disabled={reminderSending}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={submitReminders}
                                className={`px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow flex items-center gap-2 ${reminderSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={reminderSending || previewModal.loading}
                            >
                                {reminderSending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        送信中...
                                    </>
                                ) : (
                                    '一括送信を実行する'
                                )}
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
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-green-700">新規登録（手動・自動メールなし）</h3>
                            <button
                                onClick={() => setShowMemberSearch(!showMemberSearch)}
                                className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-sm font-bold hover:bg-indigo-200"
                            >
                                {showMemberSearch ? '検索を閉じる' : '受講生マスタから検索'}
                            </button>
                        </div>

                        {showMemberSearch && (
                            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded">
                                <label className="block text-sm text-indigo-800 font-bold mb-2">受講生検索（名前・ふりがな）</label>
                                <input
                                    type="text"
                                    className="border w-full p-2 rounded focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                                    placeholder="例: 山田太郎、やまだ"
                                    value={memberSearchTerm}
                                    onChange={e => setMemberSearchTerm(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto bg-white rounded border">
                                    {allMembers.filter(m => 
                                        memberSearchTerm.length > 0 && 
                                        ((m.name && m.name.includes(memberSearchTerm)) || 
                                         (m.furigana && m.furigana.includes(memberSearchTerm)))
                                    ).map(m => (
                                        <div 
                                            key={m.id} 
                                            className="p-2 border-b hover:bg-indigo-100 cursor-pointer text-sm flex justify-between"
                                            onClick={() => {
                                                setCreateForm(prev => ({
                                                    ...prev,
                                                    input_name: m.name,
                                                    input_furigana: m.furigana,
                                                    input_email: m.email || '',
                                                    matched_member_id: m.id,
                                                    applied_rank_name: m.ranks?.name || prev.applied_rank_name
                                                }));
                                                setShowMemberSearch(false);
                                                setMemberSearchTerm('');
                                            }}
                                        >
                                            <span>{m.name} ({m.furigana}) - {m.terms?.name || '期不明'}</span>
                                            {m.is_tokushin && <span className="text-xs bg-red-100 text-red-800 px-1 rounded ml-2">特進</span>}
                                        </div>
                                    ))}
                                    {memberSearchTerm.length > 0 && allMembers.filter(m => 
                                        (m.name && m.name.includes(memberSearchTerm)) || 
                                        (m.furigana && m.furigana.includes(memberSearchTerm))
                                    ).length === 0 && (
                                        <div className="p-2 text-sm text-gray-500">見つかりません</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600">
                                    氏名 (必須) 
                                    {createForm.matched_member_id && <span className="text-xs bg-green-100 text-green-800 px-1 ml-2 rounded">受講生紐付け済</span>}
                                </label>
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
                            <div className="col-span-2 flex items-center justify-between">
                                <label className="block text-sm text-gray-600">Email</label>
                                {createForm.matched_member_id && (
                                    <button 
                                        className="text-xs text-red-500 hover:text-red-700" 
                                        onClick={() => setCreateForm(prev => ({ ...prev, matched_member_id: undefined }))}
                                    >
                                        紐付けを解除
                                    </button>
                                )}
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="email"
                                    className="border w-full p-2 rounded focus:ring-green-500 focus:border-green-500"
                                    value={createForm.input_email || ''}
                                    onChange={e => setCreateForm({ ...createForm, input_email: e.target.value })}
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

                            {(!createForm.participation_type || createForm.participation_type === 'venue') ? (
                                <>
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
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm text-gray-600">オンライン視聴タイプ (必須)</label>
                                        <select
                                            className="border w-full p-2 rounded"
                                            value={createForm.venue || ''}
                                            onChange={e => handleCreateFieldChange('venue', e.target.value)}
                                        >
                                            <option value="">選択してください</option>
                                            {onlineOptionMaster.map(o => (
                                                <option key={o.id} value={o.name}>{o.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {createForm.venue?.includes('LIVE') && (
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
                                </>
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

            {/* 一括削除認証モーダル */}
            {showTruncateAuthModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[400px]">
                        <h3 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
                            <span>⚠️</span> データの初期リセット認証
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 font-medium">
                            この操作はすべての申込者データを完全に削除します。実行するには管理者のログインIDとパスワードを入力してください。
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 font-medium">ログインアカウント (ユーザー名)</label>
                                <input
                                    type="text"
                                    className="border w-full p-2 rounded focus:ring-red-500 focus:border-red-500 mt-1"
                                    value={authUsername}
                                    onChange={e => setAuthUsername(e.target.value)}
                                    placeholder="admin"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 font-medium">パスワード</label>
                                <input
                                    type="password"
                                    className="border w-full p-2 rounded focus:ring-red-500 focus:border-red-500 mt-1"
                                    value={authPassword}
                                    onChange={e => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>

                            {authError && (
                                <p className="text-sm text-red-500 font-bold bg-red-50 p-2 rounded border border-red-200">
                                    {authError}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowTruncateAuthModal(false);
                                    setAuthUsername('');
                                    setAuthPassword('');
                                    setAuthError('');
                                }}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm font-medium"
                                disabled={authVerifying}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleVerifyAndTruncate}
                                disabled={authVerifying}
                                className={`px-6 py-2 rounded text-white font-bold text-sm ${authVerifying ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {authVerifying ? '認証中...' : '認証して進む'}
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
