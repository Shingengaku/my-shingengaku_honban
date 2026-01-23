'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

    remarks?: string; // 備考欄
    environment?: string; // production | development
    cc_email?: string;
    bcc_email?: string;
    tags?: string[]; // タグの文字配列
    // リレーション
    members?: {
        generation?: number;
        furigana: string;
        ranks?: {
            name: string;
            sort_order: number;
        }
    };
    payment_key?: string; // バックエンドで生成または派生
    is_duplicate_confirmed?: boolean;
}

interface PaymentLinkItem {
    name: string;
    lecture_fee: string;
    social_fee: string;
    key: string;
    url: string;
    venue_lecture?: string;
    venue_social?: string;
}

interface Venue {
    id: number;
    name: string;
    type: 'lecture' | 'social';
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

export default function AdminDashboard() {
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

    // 高度なフィルター状態 (複数選択)
    const [filterRank, setFilterRank] = useState<Set<string>>(new Set());
    const [filterGen, setFilterGen] = useState<Set<string>>(new Set());
    const [filterProduct, setFilterProduct] = useState<Set<string>>(new Set());
    // 新しい会場フィルター
    const [filterVenueLecture, setFilterVenueLecture] = useState<Set<string>>(new Set());
    const [filterVenueSocial, setFilterVenueSocial] = useState<Set<string>>(new Set());

    // 編集モーダルの状態
    const [editingApp, setEditingApp] = useState<Application | null>(null);
    const [editForm, setEditForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [showModal, setShowModal] = useState(false);

    // メールプレビューモーダルの状態
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailPreview, setEmailPreview] = useState<{ subject: string, content: string, email?: string, cc?: string, bcc?: string } | null>(null);

    // 設定モーダルの状態
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkItem[]>([]);

    // メールテンプレートの状態
    const [emailTemplate, setEmailTemplate] = useState({ subject: '', body: '' }); // マッチした場合
    const [emailTemplateGeneral, setEmailTemplateGeneral] = useState({ subject: '', body: '' });
    const [emailTemplateResend, setEmailTemplateResend] = useState({ subject: '', body: '' });
    const [emailTemplateForgotPass, setEmailTemplateForgotPass] = useState({ subject: '', body: '' });
    const [selectedTemplateTab, setSelectedTemplateTab] = useState<'matched' | 'general' | 'resend' | 'forgot'>('matched');
    const [customResendModal, setCustomResendModal] = useState<{ isOpen: boolean, appId: string | null, subject: string, body: string, email: string }>({ isOpen: false, appId: null, subject: '', body: '', email: '' });

    const [adminEmail, setAdminEmail] = useState('');
    const [adminBccEmail, setAdminBccEmail] = useState('');
    const [productNameMaster, setProductNameMaster] = useState<{ venues: string[], socials: string[], names: string[] }>({
        venues: ['東京講演参加', '福岡講演参加', '福岡・東京講演参加'],
        socials: ['懇親会なし', '懇親会東京のみ', '懇親会福岡のみ', '懇親会両方'],
        names: []
    });
    const [termMaster, setTermMaster] = useState<number[]>([]);
    const [venueList, setVenueList] = useState<Venue[]>([]);
    const [ranks, setRanks] = useState<{ id: number, name: string }[]>([]);
    const [applicationActive, setApplicationActive] = useState(true); // 申込受付ステータス

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


    useEffect(() => {
        fetchApplications();
        fetchRanks(); // ランク情報を取得
        fetchSettings(false); // 設定をロード（モーダルは開かない）
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications');
            if (res.ok) {
                const data = await res.json();
                setApps(data);
            }
        } catch (e) {
            console.error(e);
            alert('データ取得に失敗しました');
        } finally {
            setLoading(false);
        }
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

    const fetchSettings = async (openModal = true) => {
        try {
            const [settingsRes, venuesRes] = await Promise.all([
                fetch('/api/admin/settings'),
                fetch('/api/admin/venues')
            ]);

            if (settingsRes.ok) {
                const data = await settingsRes.json();

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
                        venue_social: item.venue_social || ''
                    }));
                } else {
                    const linksObj = val || {};
                    linksArr = Object.entries(linksObj).map(([key, value]) => ({
                        name: '',
                        lecture_fee: '0',
                        social_fee: '0',
                        key,
                        url: String(value)
                    }));
                }

                setPaymentLinksData(linksArr);

                // テンプレートをロード
                setEmailTemplate(data.email_template || DEFAULT_TEMPLATE);
                setEmailTemplateGeneral(data.email_template_general || DEFAULT_TEMPLATE_GENERAL);
                setEmailTemplateResend(data.email_template_resend || DEFAULT_TEMPLATE_RESEND);
                setEmailTemplateForgotPass(data.email_template_forgot_pass || DEFAULT_TEMPLATE_FORGOT_PASS);


                if (data.product_name_master) {
                    const pm = data.product_name_master;
                    setProductNameMaster({
                        names: Array.isArray(pm.names) ? pm.names : [],
                        venues: Array.isArray(pm.venues) ? pm.venues : ['東京講演参加', '福岡講演参加', '福岡・東京講演参加'],
                        socials: Array.isArray(pm.socials) ? pm.socials : ['懇親会なし', '懇親会東京のみ', '懇親会福岡のみ', '懇親会両方'],
                    });
                }
                const tm = data.term_master;
                if (Array.isArray(tm)) {
                    setTermMaster(tm.map(Number).sort((a: number, b: number) => a - b));
                }

                if (venuesRes.ok) {
                    const vData = await venuesRes.json();
                    setVenueList(vData);
                }

                setAdminEmail(data.admin_email || '');
                setAdminBccEmail(data.admin_bcc_email || '');
                setApplicationActive(data.application_active !== false); // デフォルトtrue

                if (openModal) {
                    setShowSettingsModal(true);
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
                venue_social: item.venue_social
            }));

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_links,
                    email_template: emailTemplate,
                    email_template_general: emailTemplateGeneral,
                    email_template_resend: emailTemplateResend,
                    email_template_forgot_pass: emailTemplateForgotPass,
                    email_template_forgot_pass: emailTemplateForgotPass,
                    product_name_master: productNameMaster,
                    admin_email: adminEmail,
                    admin_bcc_email: adminBccEmail,
                    application_active: applicationActive
                })
            });

            if (res.ok) {
                alert('設定を保存しました');
                setShowSettingsModal(false);
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

    // 重複名検出ロジック
    const nameCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        apps.forEach(app => {
            const n = app.input_name.trim();
            counts[n] = (counts[n] || 0) + 1;
        });
        return counts;
    }, [apps]);

    const confirmDuplicate = async (id: string) => {
        // Modal provides confirmation
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id], is_duplicate_confirmed: true }),
            });
            if (res.ok) {
                alert('確認済にしました');
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
            bcc_email: app.bcc_email || adminBccEmail || ''
        });
        setShowModal(true);
    };

    // Key文字列 ("【Rank】Venue/Social") からフィールドを抽出するヘルパー
    const parseKey = (key: string) => {
        const match = key.match(/^【(.+)】(.+)\/(.+)$/);
        if (match) {
            return {
                rank: match[1],
                venue: match[2],
                social: match[3]
            };
        }
        return null;
    };

    const handleKeyChange = (key: string) => {
        // 1. 商品マスタ (PaymentLinks) で検索を試みる
        const product = paymentLinksData.find(p => p.key === key || p.name === key);
        let newVenue = '';
        let newSocial = '';

        if (product) {
            if (product.venue_lecture) newVenue = product.venue_lecture;
            if (product.venue_social) newSocial = product.venue_social;
        }

        // 2. レガシーパース (keyにフォーマット情報が含まれている場合、それが優先またはフォールバックになる可能性があります)
        const parsed = parseKey(key);

        setEditForm(prev => ({
            ...prev,
            payment_key: key,
            applied_rank_name: parsed ? parsed.rank : prev.applied_rank_name,
            venue: parsed ? parsed.venue : (newVenue || prev.venue),
            social_venue: parsed ? parsed.social : (newSocial || prev.social_venue)
        }));
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
                bcc_email: editForm.bcc_email
            };

            const res = await fetch('/api/admin/applications/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                alert('更新しました');
                setShowModal(false);
                setEditingApp(null);
                fetchApplications(); // Reload to see changes
            } else {
                const data = await res.json();
                alert(`更新に失敗しました: ${data.error || '不明なエラー'} ${data.details || ''}`);
            }
        } catch (e) {
            alert('エラーが発生しました');
            console.error(e);
        }
    };

    const exportCSV = (useFilter: boolean = true) => {
        const targetApps = useFilter ? [...filteredApps] : [...apps]; // ソート用にコピーを使用

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
            // 1. ランク優先度
            const rankA = a.applied_rank_name || a.members?.ranks?.name || 'ゲスト';
            const rankB = b.applied_rank_name || b.members?.ranks?.name || 'ゲスト';

            const rDiff = getRankOrder(rankA) - getRankOrder(rankB);
            if (rDiff !== 0) return rDiff;

            // 2. 期 (昇順)
            const genA = a.members?.generation || 9999;
            const genB = b.members?.generation || 9999;
            const gDiff = genA - genB;
            if (gDiff !== 0) return gDiff;

            // 3. ふりがな (昇順)
            const furiA = a.members?.furigana || a.input_furigana || '';
            const furiB = b.members?.furigana || b.input_furigana || '';
            return furiA.localeCompare(furiB, 'ja');
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const header = [
            'ID', '氏名', 'ふりがな', 'メールアドレス', '属性', '期', '会場', '懇親会', '合計金額', '支払状況', '環境', '申込日時', '備考', 'タグ'
        ].join(',');

        const rows = targetApps.map(app => {
            const rank = app.applied_rank_name || app.members?.ranks?.name || '一般';
            const gen = app.members?.generation ? `${app.members.generation}期` : '-';
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
                `"${app.venue || ''}"`,
                `"${social}"`,
                app.total_amount,
                app.payment_status,
                `"${env}"`,
                `"${new Date(app.created_at).toLocaleString('ja-JP')}"`,
                `"${remarks}"`,
                `"${tags}"`
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

    const handleTruncate = async (e: React.MouseEvent) => {
        if (!e.ctrlKey && !e.metaKey) {
            alert('誤操作防止のため、Ctrlキーを押しながらクリックしてください');
            return;
        }
        if (!confirm('【危険】お申込みデータをリセット（全削除）しますか？\n\n※マスタデータ（会員、属性、期、商品、設定）は消えません。\n※この操作は取り消せません。必ず事前にCSV出力を行ってください。')) return;
        if (!confirm('【最終確認】本当にお申込みデータだけを削除してよろしいですか？')) return;

        try {
            const res = await fetch('/api/admin/applications/truncate', { method: 'POST' });
            if (res.ok) {
                alert('お申込みデータを削除しました（マスタデータは保持されています）');
                fetchApplications();
            } else {
                alert('削除に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

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

            // Normalize "No Participation" variations to 'none' for filtering locally
            if (v === '参加しない' || v === '不参加' || v === 'none') v = 'none';
            // Map known English keys to Japanese names for filtering
            else if (v === 'tokyo') v = '東京';
            else if (v === 'fukuoka') v = '福岡';
            else if (v === 'both') v = '東京・福岡';

            if (!filterVenueLecture.has(v)) {
                return false;
            }
        }

        // Venue (Social) Filter
        if (filterVenueSocial.size > 0) {
            let s = app.social_venue || 'none';
            if (s === '参加しない' || s === '不参加' || s === 'none') s = 'none';
            else if (s === 'tokyo') s = '東京';
            else if (s === 'fukuoka') s = '福岡';
            else if (s === 'both') s = '両方参加';

            if (!filterVenueSocial.has(s)) return false;
        }

        return true;
    });

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
        { label: '参加しない', value: 'none' }
    ];
    // Remove duplicates by value just in case
    const uniqueVenueLectureOptions = Array.from(new Map(venueLectureOptions.map(item => [item.value, item])).values());

    const venueSocialOptions = [
        ...Array.from(new Set([...venueList.filter(v => v.type === 'social').map(v => v.name)])).map(v => ({ label: v as string, value: v as string })),
        { label: '参加しない', value: 'none' }
    ];
    const uniqueVenueSocialOptions = Array.from(new Map(venueSocialOptions.map(item => [item.value, item])).values());


    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">神言学 管理ダッシュボード</h1>
                    <div className="space-x-4">
                        <Link href="/admin/members" className="text-sm px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">受講生マスタ</Link>
                        <Link href="/admin/ranks" className="text-sm px-3 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">属性マスタ</Link>
                        <Link href="/admin/products" className="text-sm px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100">商品マスタ</Link>
                        <Link href="/admin/venues" className="text-sm px-3 py-1 bg-pink-50 text-pink-700 rounded hover:bg-pink-100">会場マスタ</Link>
                        <Link href="/admin/terms" className="text-sm px-3 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">期マスタ</Link>
                        <Link href="/admin/users" className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">管理者設定</Link>
                        <button onClick={fetchApplications} className="text-sm text-blue-600 hover:underline ml-2">再読込</button>
                        <button onClick={() => fetchSettings(true)} className="text-sm text-gray-600 hover:text-gray-900 border px-3 py-1 rounded">設定変更</button>
                        <button onClick={handleLogout} className="text-sm text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1 rounded ml-2">ログアウト</button>
                    </div>
                </div>

                {/* コントロールバー */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
                    <div className="flex flex-wrap gap-4 justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => setFilter('unpaid')} className={`px-4 py-2 rounded-md ${filter === 'unpaid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>未決済</button>
                            <button onClick={() => setFilter('paid')} className={`px-4 py-2 rounded-md ${filter === 'paid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>決済済</button>
                            <button onClick={() => setFilter('cancelled')} className={`px-4 py-2 rounded-md ${filter === 'cancelled' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>キャンセル</button>
                            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>全て</button>
                        </div>
                        {/* Statistics Display */}
                        <div className="flex gap-4 text-sm bg-gray-50 px-4 py-2 rounded border border-gray-200">
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">お申込み総数</span>
                                <span className="font-bold text-gray-800">{apps.length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">未決済</span>
                                <span className="font-bold text-red-600">{apps.filter(a => a.payment_status === 'unpaid').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">決済済</span>
                                <span className="font-bold text-green-600">{apps.filter(a => a.payment_status === 'paid').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">キャンセル</span>
                                <span className="font-bold text-gray-600">{apps.filter(a => a.payment_status === 'cancelled').length}</span>
                            </div>
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">表示中</span>
                                <span className="font-bold text-indigo-600">{filteredApps.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Filters with MultiSelect */}
                    <div className="flex gap-2 items-start">
                        <MultiSelect
                            label="全ての属性"
                            options={rankOptions}
                            selected={filterRank}
                            onChange={setFilterRank}
                            width="w-40"
                        />
                        <MultiSelect
                            label="全ての期"
                            options={termOptions}
                            selected={filterGen}
                            onChange={setFilterGen}
                            width="w-32"
                        />
                        <MultiSelect
                            label="全ての商品名"
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
                            label="全ての懇親会会場"
                            options={uniqueVenueSocialOptions}
                            selected={filterVenueSocial}
                            onChange={setFilterVenueSocial}
                            width="w-40"
                        />
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Search Box */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="名前・フリガナ・Emailで検索 (スペース区切り)"
                                className="border rounded px-3 py-2 text-sm w-80"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >✕</button>
                            )}
                        </div>

                        <div className="flex flex-col gap-1 items-end ml-4">
                            <button onClick={() => exportCSV(false)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm w-48">全データCSV出力</button>
                            <button onClick={() => exportCSV(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm w-48">表示中のみCSV出力</button>
                        </div>
                    </div>

                    {/* Reset Data Button (Bottom Right) */}
                    <div className="flex justify-end pt-2 border-t border-gray-100 mt-2">
                        <button onClick={handleTruncate} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded hover:bg-red-50" title="Ctrlキーを押しながらクリック">
                            データをリセット(削除)
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <div>
                        {selectedIds.size > 0 && (
                            <div className="flex gap-2">
                                <button onClick={markAsPaid} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                                    選択した {selectedIds.size} 件を「決済済」にする
                                </button>
                                <button onClick={markAsUnpaid} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                                    選択した {selectedIds.size} 件を「未決済」に戻す
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={handleTruncate} className="hidden" title="Moved to filter bar"></button>
                </div>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedIds(new Set(filteredApps.map(a => a.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={filteredApps.length > 0 && selectedIds.size === filteredApps.length}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申込日時</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前 / Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">属性 / 備考</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">期</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">会場 / 懇親会</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額 / 商品名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
                        ) : filteredApps.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-4 text-center">データがありません</td></tr>
                        ) : (
                            filteredApps.map((app) => {
                                const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
                                const gen = app.members?.generation ? `${app.members.generation}期` : '';
                                const furigana = app.members?.furigana || app.input_furigana;

                                const isAlert = app.remarks?.includes('商品マスタ');
                                // Check if ignored
                                const isIgnored = app.tags?.includes('ignore_duplicate');

                                return (
                                    <tr key={app.id} className={`${selectedIds.has(app.id) ? 'bg-indigo-50' : (isAlert ? 'bg-red-50' : '')} ${isAlert ? 'text-red-600' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(app.id)}
                                                onChange={() => toggleSelect(app.id)}
                                                className="mt-1"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                                            {new Date(app.created_at).toLocaleString('ja-JP')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${app.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                                    app.payment_status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {app.payment_status === 'paid' ? '決済済' : app.payment_status === 'cancelled' ? 'キャンセル' : '未決済'}
                                                </span>
                                                {/* @ts-ignore */}
                                                {app.environment === 'production' ? (
                                                    <span className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 border border-red-100 rounded">本番データ</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded">テストデータ</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <div className="text-sm font-medium text-gray-900">
                                                {app.input_name}
                                                {(nameCounts[app.input_name.trim()] || 0) > 1 && !isIgnored && (
                                                    <div className="mt-1">
                                                        {app.is_duplicate_confirmed ? (
                                                            <span
                                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 transition-colors"
                                                                onClick={() => handleDuplicateClick(app)}
                                                            >
                                                                同姓(確認済)
                                                            </span>
                                                        ) : (
                                                            <span
                                                                onClick={() => handleDuplicateClick(app)}
                                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200 transition-colors"
                                                                title="クリックして操作を選択"
                                                            >
                                                                ⚠ 同姓あり(要確認)
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Introduction Badge */}
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
                                        <td className="px-6 py-4 align-top">
                                            <div className="text-sm text-gray-900">{rankName}</div>
                                            {app.remarks && (
                                                <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap max-w-xs">{app.remarks}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <div className="text-sm text-gray-500">{gen}</div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="text-sm text-gray-900">
                                                <span className="font-bold text-xs text-gray-400 block">講義:</span>
                                                {app.venue === 'both' ? '東京・福岡' : (app.venue === 'tokyo' ? '東京' : (app.venue === 'fukuoka' ? '福岡' : (app.venue === 'none' ? '参加しない' : '-')))}
                                            </div>
                                            <div className="text-sm text-gray-900 mt-1">
                                                <span className="font-bold text-xs text-gray-400 block">懇親会:</span>
                                                {app.social_venue === 'both' ? '両方参加' : (app.social_venue === 'tokyo' ? '東京' : (app.social_venue === 'fukuoka' ? '福岡' : (app.social_venue === 'none' ? '参加しない' : '-')))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                                            <div>¥{app.total_amount.toLocaleString()}</div>
                                            <div className="text-xs text-gray-400 select-all cursor-pointer truncate max-w-[150px]" title={app.payment_key}>{app.payment_key}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex flex-col space-y-1 align-top">
                                            <div className="space-x-2">
                                                <button onClick={() => openEditModal(app)} className="text-indigo-600 hover:text-indigo-900">編集</button>
                                                {app.payment_status !== 'cancelled' && (
                                                    <button onClick={() => handleCancel(app.id)} className="text-red-600 hover:text-red-900">キャンセル</button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleResend(app.id)} className="text-gray-500 hover:text-gray-900 text-xs text-left">✉ 再送</button>
                                                <button onClick={() => handlePreviewEmail(app.id)} className="text-blue-500 hover:text-blue-900 text-xs text-left">👁 閲覧</button>
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
                                        <label className="block text-sm font-bold text-gray-700">ふりがな</label>
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
                                        <label className="block text-sm font-bold text-gray-700">期 (Term)</label>
                                        <input
                                            type="number"
                                            className="border w-full p-2 rounded"
                                            value={editForm.member_generation || ''}
                                            onChange={e => setEditForm({ ...editForm, member_generation: Number(e.target.value) })}
                                            placeholder="数字のみ (例: 1)"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">個別CC</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={editForm.cc_email || ''}
                                            onChange={e => setEditForm({ ...editForm, cc_email: e.target.value })}
                                            placeholder="カンマ区切りで複数指定可"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">個別BCC</label>
                                        <input
                                            className="border w-full p-2 rounded"
                                            value={editForm.bcc_email || ''}
                                            onChange={e => setEditForm({ ...editForm, bcc_email: e.target.value })}
                                            placeholder="カンマ区切りで複数指定可"
                                        />
                                    </div>
                                </div>

                                {/* Product Name with Auto-Populate */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 text-indigo-700">商品名 (属性/会場/懇親会を一括設定)</label>
                                    <select
                                        className="border w-full p-2 rounded"
                                        value={editForm.payment_key || ''}
                                        onChange={e => handleKeyChange(e.target.value)}
                                    >
                                        <option value="">(選択なし - 手動入力)</option>
                                        {keyCandidates.map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">参加会場 (講義)</label>
                                        <select
                                            className="border w-full p-2 rounded"
                                            value={editForm.venue || ''}
                                            onChange={(e) => {
                                                setEditForm({ ...editForm, venue: e.target.value, social_venue: '' });
                                            }}
                                        >
                                            <option value="">(選択なし)</option>
                                            {venueList.filter(v => v.type === 'lecture').map(opt => (
                                                <option key={opt.id} value={opt.name}>{opt.name}</option>
                                            ))}
                                            <option value="参加しない">参加しない</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">参加会場 (懇親会)</label>
                                        <select
                                            className="border w-full p-2 rounded bg-white disabled:bg-gray-100"
                                            value={editForm.social_venue || ''}
                                            onChange={e => setEditForm({ ...editForm, social_venue: e.target.value })}
                                            disabled={!editForm.venue}
                                        >
                                            <option value="">(選択なし)</option>
                                            {(() => {
                                                const lectureVenue = editForm.venue;
                                                if (!lectureVenue) return null;

                                                const socialVenues = venueList.filter(v => v.type === 'social');
                                                const notParticipating = "参加しない";
                                                let available = [];

                                                if (lectureVenue.includes('・')) {
                                                    const parts = lectureVenue.split('・');
                                                    available = socialVenues.filter(v =>
                                                        v.name === lectureVenue ||
                                                        parts.includes(v.name) ||
                                                        v.name === notParticipating
                                                    );
                                                } else {
                                                    available = socialVenues.filter(v =>
                                                        v.name === lectureVenue ||
                                                        v.name === notParticipating
                                                    );
                                                }

                                                return (
                                                    <>
                                                        {available.map(opt => (
                                                            <option key={opt.id} value={opt.name}>{opt.name}</option>
                                                        ))}
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
                                        <label className="block text-sm font-bold text-gray-700">判定属性</label>
                                        <select
                                            className="border w-full p-2 rounded"
                                            value={editForm.applied_rank_name || ''}
                                            onChange={e => setEditForm({ ...editForm, applied_rank_name: e.target.value })}
                                        >
                                            <option value="">指定なし</option>
                                            {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">合計金額</label>
                                        <input
                                            type="number"
                                            className="border w-full p-2 rounded"
                                            value={editForm.total_amount || 0}
                                            onChange={e => setEditForm({ ...editForm, total_amount: Number(e.target.value) })}
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
                            <div><span className="font-bold">宛先:</span> {emailPreview.email || '（不明）'}</div>
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
                        <h3 className="text-lg font-bold mb-4">再送メールの編集</h3>
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

                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h4 className="font-bold text-gray-700 mb-2">公開ステータス</h4>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-sm block">申込受付</span>
                                    <p className="text-xs text-gray-500">
                                        OFFにすると、一般の申込画面が利用不可になり、受付停止メッセージが表示されます。
                                    </p>
                                </div>
                                <button
                                    onClick={() => setApplicationActive(!applicationActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${applicationActive ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applicationActive ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                            <div className="mt-2 text-right">
                                <span className={`text-sm font-bold ${applicationActive ? 'text-indigo-600' : 'text-red-600'}`}>
                                    {applicationActive ? '現在: 受付中' : '現在: 停止中'}
                                </span>
                            </div>
                        </div>

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
                                <label className="block text-sm text-gray-600 font-bold">管理者BCCメールアドレス</label>
                                <p className="text-xs text-gray-500 mb-1">
                                    お申込み者（受講生）に送られるメールのBCCとして、このアドレスに送信されます（受信者には見えません）。
                                </p>
                                <input
                                    className="border w-full p-2 rounded"
                                    value={adminBccEmail}
                                    onChange={e => setAdminBccEmail(e.target.value)}
                                    placeholder="admin-bcc@example.com"
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
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'resend' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('resend')}
                                >
                                    再送メール
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${selectedTemplateTab === 'forgot' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setSelectedTemplateTab('forgot')}
                                >
                                    パスワード忘
                                </button>
                            </div>

                            <div className="bg-yellow-50 p-3 rounded text-xs mb-2">
                                利用可能な変数:
                                {selectedTemplateTab !== 'forgot' ? (
                                    <> {'{{name}}'}, {'{{rank}}'}, {'{{venue}}'}, {'{{social_venue}}'}, {'{{amount}}'}, {'{{payment_link_section}}'}</>
                                ) : (
                                    <> {'{{username}}'}, {'{{reset_link}}'}</>
                                )}
                            </div>

                            {selectedTemplateTab === 'matched' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名 (商品マッチ時)</label>
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
                                        <label className="block text-sm text-gray-600 text-xs">件名 (一般・マッチなし)</label>
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

                            {selectedTemplateTab === 'resend' && (
                                <>
                                    <div className="mb-2">
                                        <label className="block text-sm text-gray-600 text-xs">件名 (再送)</label>
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
                                        <label className="block text-sm text-gray-600 text-xs">件名 (パスワードリセット)</label>
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
                        </div>

                        <div className="mb-6 border-t pt-4">
                            <h4 className="font-bold text-gray-700 mb-2">マスタ管理へのリンク</h4>
                            <div className="flex gap-4">
                                <Link href="/admin/products" className="text-blue-600 hover:underline flex items-center">
                                    商品・決済リンク管理画面へ ↗
                                </Link>
                                <Link href="/admin/terms" className="text-blue-600 hover:underline flex items-center">
                                    期マスタ管理画面へ ↗
                                </Link>
                                <Link href="/admin/venues" className="text-blue-600 hover:underline flex items-center">
                                    会場マスタ管理画面へ ↗
                                </Link>
                                <Link href="/admin/popup" className="text-blue-600 hover:underline flex items-center">
                                    申込画面お知らせ設定へ ↗
                                </Link>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={saveSettings}
                                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold"
                            >
                                設定を保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Action Modal */}
            {showDuplicateModal && duplicateTargetApp && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-[400px]">
                        <h3 className="text-lg font-bold mb-4">同姓確認の操作</h3>
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
            )}
        </div>
    );
}
