'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPaymentKey } from '@/lib/payment';
import { matchProduct, getVenueDisplayName, isOnlineVenue, getSocialOptionsForLecture } from '@/lib/venueUtils';

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

    // 高度なフィルター状慁E(褁E��選抁E
    const [filterRank, setFilterRank] = useState<Set<string>>(new Set());
    const [filterGen, setFilterGen] = useState<Set<string>>(new Set());
    const [filterProduct, setFilterProduct] = useState<Set<string>>(new Set());
    // 新しい会場フィルター
    const [filterVenueLecture, setFilterVenueLecture] = useState<Set<string>>(new Set());
    const [filterVenueSocial, setFilterVenueSocial] = useState<Set<string>>(new Set());
    // オンライン視�Eフィルター
    const [filterOnlineOption, setFilterOnlineOption] = useState<Set<string>>(new Set());
    const [filterParticipationType, setFilterParticipationType] = useState<'all' | 'venue' | 'online'>('all');

    // 編雁E��ーダルの状慁E
    const [editingApp, setEditingApp] = useState<Application | null>(null);
    const [editForm, setEditForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [showModal, setShowModal] = useState(false);

    // 新規登録モーダルの状態
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<Partial<Application & { member_generation?: number }>>({});
    const [creating, setCreating] = useState(false);

    // メールプレビューモーダルの状慁E
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailPreview, setEmailPreview] = useState<{ subject: string, content: string, email?: string, cc?: string, bcc?: string } | null>(null);

    // 設定モーダルの状慁E
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkItem[]>([]);
    const [baseSocialFeeTokyo, setBaseSocialFeeTokyo] = useState<number>(11000);
    const [baseSocialFeeFukuoka, setBaseSocialFeeFukuoka] = useState<number>(13000);

    // メールチE��プレート�E状慁E
    const [emailTemplate, setEmailTemplate] = useState({ subject: '', body: '' }); // マッチした場吁E
    const [emailTemplateGeneral, setEmailTemplateGeneral] = useState({ subject: '', body: '' });
    const [emailTemplateFree, setEmailTemplateFree] = useState({ subject: '', body: '' }); // 0冁E無斁Eの場吁E
    const [emailTemplateFreeOnline, setEmailTemplateFreeOnline] = useState({ subject: '', body: '' }); // 0円(オンライン)
    const [emailTemplateResend, setEmailTemplateResend] = useState({ subject: '', body: '' });
    const [emailTemplateForgotPass, setEmailTemplateForgotPass] = useState({ subject: '', body: '' });
    const [selectedTemplateTab, setSelectedTemplateTab] = useState<'matched' | 'general' | 'free' | 'free_online' | 'resend' | 'forgot'>('matched');
    const [customResendModal, setCustomResendModal] = useState<{ isOpen: boolean, appId: string | null, subject: string, body: string, email: string }>({ isOpen: false, appId: null, subject: '', body: '', email: '' });

    const [adminEmail, setAdminEmail] = useState('');
    const [adminBccEmail, setAdminBccEmail] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [venueList, setVenueList] = useState<Venue[]>([]);
    const [onlineOptionMaster, setOnlineOptionMaster] = useState<{ id: string, name: string }[]>([]);
    const [ranks, setRanks] = useState<{ id: number, name: string }[]>([]);
    const [termMaster, setTermMaster] = useState<number[]>([]);
    const [applicationActive, setApplicationActive] = useState(true); // 申込受付スチE�Eタス

    // ソート機�Eの状慁E
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // 簡易エクセル出力設定
    const [exportMonth, setExportMonth] = useState('');
    const [exportTokyoDate, setExportTokyoDate] = useState('15日(日)');
    const [exportFukuokaDate, setExportFukuokaDate] = useState('22日(日)');
    const [exportTermLabel, setExportTermLabel] = useState('期'); // デフォルト「期」
    const [exportRemarks, setExportRemarks] = useState('');

    // Persist Export Settings
    useEffect(() => {
        const savedMonth = localStorage.getItem('shingengaku_export_month');
        if (savedMonth) setExportMonth(savedMonth);
        const savedTokyo = localStorage.getItem('shingengaku_export_tokyo');
        if (savedTokyo) setExportTokyoDate(savedTokyo);
        const savedFukuoka = localStorage.getItem('shingengaku_export_fukuoka');
        if (savedFukuoka) setExportFukuokaDate(savedFukuoka);

        const savedTermLabel = localStorage.getItem('shingengaku_export_term_label');
        if (savedTermLabel) setExportTermLabel(savedTermLabel);
        const savedRemarks = localStorage.getItem('shingengaku_export_remarks');
        if (savedRemarks) setExportRemarks(savedRemarks);
    }, []);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_month', exportMonth);
    }, [exportMonth]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_tokyo', exportTokyoDate);
    }, [exportTokyoDate]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_fukuoka', exportFukuokaDate);
    }, [exportFukuokaDate]);

    useEffect(() => {
        localStorage.setItem('shingengaku_export_term_label', exportTermLabel);
    }, [exportTermLabel]);

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

    useEffect(() => {
        fetchApplications();
        fetchRanks(); // ランク惁E��を取征E
        fetchOnlineOptions(); // オンラインマスタ取征E
        fetchSettings(false); // 設定をロード（モーダルは開かなぁE��E
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/applications', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                // チE�Eタの整形 (participation_typeの補完など)
                const formatted = data.map((d: any) => ({
                    ...d,
                    // タグから推測する場合�EロジチE�� (後方互換性)
                    participation_type: d.participation_type || (d.venue && ['LIVE視�E', 'アーカイブ視�E'].some((o: string) => d.venue.includes(o)) ? 'online' : 'venue')
                }));
                setApps(formatted);
            }
        } catch (e) {
            console.error(e);
            alert('チE�Eタ取得に失敗しました');
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
                const data = await settingsRes.json();

                // 決済リンクを解极E
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
                        rank_id: item.rank_id ? String(item.rank_id) : undefined
                    }));
                } else {
                    const linksObj = val || {};
                    linksArr = Object.entries(linksObj).map(([key, value]) => ({
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

                // 基本懇親会費マスタをロード
                if (data.base_social_fee_tokyo !== undefined) setBaseSocialFeeTokyo(Number(data.base_social_fee_tokyo));
                if (data.base_social_fee_fukuoka !== undefined) setBaseSocialFeeFukuoka(Number(data.base_social_fee_fukuoka));


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
                setTestEmail(data.test_email || '');
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
        // 明示皁E��定義された商品名マスタリストを使用
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
                rank_id: item.rank_id || null
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
            const n = app.input_name.trim();
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
                fetchApplications(); // 再取得
            } else {
                alert('エラーが発生しました');
            }
        } catch (e) {
            alert('通信エラー');
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
            participation_type: app.participation_type
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
            if (field === 'applied_rank_name' || field === 'venue' || field === 'social_venue') {
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
                } else {
                    next.payment_key = ''; // reset if not found explicitly
                }


                // オンライン判定の自動更新
                const isOnline = venue.includes('LIVE') || venue.includes('ライブ') || 
                                venue.includes('オンライン') || venue.includes('アーカイブ');
                next.participation_type = isOnline ? 'online' : 'venue';

                // 商品マスタから金額を取得
                const product = matchedProduct;
                if (product) {
                    const lectureFee = Number(product.lecture_fee) || 0;
                    const socialFee = Number(product.social_fee) || 0;
                    next.total_amount = lectureFee + socialFee;
                }
            }
            return next;
        });
    };

    const handleKeyChange = (key: string) => {
        const parsed = parseKey(key);
        if (parsed) {
            const product = paymentLinksData.find(p => p.key === key || p.name === key);
            const amount = product ? (Number(product.lecture_fee) || 0) + (Number(product.social_fee) || 0) : editForm.total_amount;
            
            setEditForm(prev => ({
                ...prev,
                payment_key: key,
                applied_rank_name: parsed.rank,
                venue: parsed.venue,
                social_venue: parsed.social,
                total_amount: amount,
                participation_type: (parsed.venue.includes('LIVE') || parsed.venue.includes('ライブ')) ? 'online' : 'venue'
            }));
        } else {
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
                online_venues: editForm.online_venues
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
        const map = new Map<string, Application>();

        sourceApps.forEach(app => {
            // 名寄せキーの生成
            // 名前Email会場懇親会商品(Key)
            // 空白のゆらぎをある程度許容するかは要検討だが、まずは完全一致かつTrim済みで比較
            const key = [
                app.input_name.trim(),
                app.input_email.trim(),
                app.venue || '',
                app.social_venue || '',
                app.payment_key || ''
            ].join('|');

            if (map.has(key)) {
                const existing = map.get(key)!;
                let replace = false;

                // 1. 決済ステータス比較(paid優先)
                if (existing.payment_status !== 'paid' && app.payment_status === 'paid') {
                    replace = true;
                } else if (existing.payment_status === 'paid' && app.payment_status !== 'paid') {
                    replace = false;
                } else {
                    // 2. ステータスが同じなら、更新日時が新しい方を採用
                    if (new Date(app.updated_at) > new Date(existing.updated_at)) {
                        replace = true;
                    }
                }

                if (replace) {
                    map.set(key, app);
                }
            } else {
                map.set(key, app);
            }
        });

        return Array.from(map.values());
    };

    const exportCSV = (useFilter: boolean = true) => {
        // useFilterがtrueの場合は画面上のフィルタ結果(filteredApps)を使うが、
        // 全データ(apps)の場合でもfilteredAppsを使う構成になっているため修正の余地あり。
        // ここでは、useFilter=falseなら全データ(apps)を対象にし、かつ重複排除を行う。
        // useFilter=true(表示中のみ)なら、ユーザーが見ているそのままを出力すべきか、そこでも重複排除すべきか？
        // -> 「エクセル書き出しの際、またはCSV出力の際に...」という要望なので、基本的に出力時は重複排除する方針とする。

        // ソースリスト
        let sourceList = useFilter ? [...filteredApps] : [...apps];

        // 重複排除を実施
        const targetApps = deduplicateApps(sourceList);

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

            // 2. 期(昇順)
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
        const monthStr = exportMonth || (new Date().getMonth() + 1).toString();
        if (!confirm(`【簡易版】エクセルファイルを生成しますか？\n対象月: ${monthStr}月\n東京日程: ${exportTokyoDate}〜\n福岡日程: ${exportFukuokaDate}〜\n(東京・福岡・オンラインの3列表示・A4縦・罫線あり・グループ分け・連番)`)) return;

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

            // Data Preparation
            const getMemberInfo = (app: Application) => {
                let name = app.input_name + 'さま'; // Append suffix
                const gen = app.members?.generation || 99;
                const term = gen === 99 ? '' : `${gen}期`; // Use standard suffix for data
                const furigana = app.members?.furigana || app.input_furigana || '';
                const vL = app.venue || '';
                const vS = app.social_venue || '';
                const isBoth = vL.includes('both') || vL.includes('東京・福岡') || vS.includes('both') || vS.includes('両方');
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

                return { name, term, furigana, isBoth, gen, priority, rankName };
            };

            const normalizeKana = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
            const sorterName = (a: any, b: any) => normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
            const sorterTerm = (a: any, b: any) => {
                if (a.gen !== b.gen) return a.gen - b.gen;
                return normalizeKana(a.furigana).localeCompare(normalizeKana(b.furigana), 'ja');
            };

            // キャンセルされたデータは含まないようにする
            const uniqueApps = deduplicateApps(apps).filter(a => a.payment_status !== 'cancelled');

            // Filter Lists
            const rawTokyo = uniqueApps.filter(a => {
                const v = a.venue || '';
                const k = a.payment_key || '';

                // Safety: If venue is explicitly Fukuoka only, exclude from Tokyo list
                if ((v.includes('福岡') || v.includes('fukuoka')) &&
                    !v.includes('東京') && !v.includes('tokyo') && !v.includes('both') && !v.includes('両方')) {
                    return false;
                }

                // Standard match OR Referral match with Tokyo keyword
                const isStandard = v.includes('東京') || v.includes('tokyo') || v.includes('both');
                const isReferral = (v.includes('紹介') || v.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介')) &&
                    (v.includes('東京') || k.includes('東京') || v.includes('Tokyo') || k.includes('Tokyo'));
                return isStandard || isReferral;
            }).map(getMemberInfo);

            const rawFukuoka = uniqueApps.filter(a => {
                const v = a.venue || '';
                const k = a.payment_key || '';

                // Safety: If venue is explicitly Tokyo only, exclude from Fukuoka list
                if ((v.includes('東京') || v.includes('tokyo')) &&
                    !v.includes('福岡') && !v.includes('fukuoka') && !v.includes('both') && !v.includes('両方')) {
                    return false;
                }

                // Standard match OR Referral match with Fukuoka keyword
                const isStandard = v.includes('福岡') || v.includes('fukuoka') || v.includes('both');
                const isReferral = (v.includes('紹介') || v.includes('ご紹介') || k.includes('紹介') || k.includes('ご紹介')) &&
                    (v.includes('福岡') || k.includes('福岡') || v.includes('Fukuoka') || k.includes('Fukuoka'));
                return isStandard || isReferral;
            }).map(getMemberInfo);

            const rawOnline = uniqueApps.filter(a => {
                if (a.participation_type === 'online') return true;
                const v = a.venue || '';
                return v.includes('LIVE') || v.includes('オンライン') || v.includes('アーカイブ');
            }).map(getMemberInfo);

            // Grouping Helper
            const groupList = (list: any[]) => {
                return {
                    tokushin: list.filter(i => i.priority === 1).sort(sorterTerm),
                    terms: list.filter(i => i.priority === 2).sort(sorterTerm),
                    executive: list.filter(i => i.priority === 3).sort(sorterName),
                    referral: list.filter(i => i.priority === 4).sort(sorterName)
                };
            };
            const tokyoGroups = groupList(rawTokyo);
            const fukuokaGroups = groupList(rawFukuoka);
            const onlineGroups = groupList(rawOnline);

            // Columns (3 cols + spacers)
            const colWidths = [4, 18, 6];
            const spacerWidth = 2;
            ws.columns = [
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] },
                { width: spacerWidth },
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] },
                { width: spacerWidth },
                { width: colWidths[0] }, { width: colWidths[1] }, { width: colWidths[2] },
            ];

            // Headers
            ws.mergeCells('A1:K1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `神言学集中講座 ${monthStr}月`;
            titleCell.font = { size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };
            titleCell.border = { bottom: { style: 'thick' } };

            // Counts Row
            ws.getRow(2).height = 40; // Ensure height for 2 lines
            ws.mergeCells('A2:C2');
            ws.getCell('A2').value = `東京会場 ${monthStr}月${exportTokyoDate}\n参加者: ${rawTokyo.length}名`;
            ws.getCell('A2').font = { bold: true };
            ws.getCell('A2').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

            ws.mergeCells('E2:G2');
            ws.getCell('E2').value = `福岡会場 ${monthStr}月${exportFukuokaDate}\n参加者: ${rawFukuoka.length}名`;
            ws.getCell('E2').font = { bold: true };
            ws.getCell('E2').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            ws.getCell('E2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

            ws.mergeCells('I2:K2');
            ws.getCell('I2').value = `オンライン配信\n申込者: ${rawOnline.length}名`;
            ws.getCell('I2').font = { bold: true };
            ws.getCell('I2').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
            ws.getCell('I2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

            // Render Block Helper
            const renderBlock = (startRow: number, colOffset: number, title: string, data: any[], startSeq: number) => {
                if (data.length === 0) return { nextRow: startRow, nextSeq: startSeq };
                let currentRow = startRow;

                // Group Title
                const titleCellRef = ws.getRow(currentRow).getCell(colOffset + 1);
                ws.mergeCells(currentRow, colOffset + 1, currentRow, colOffset + 3);
                titleCellRef.value = title;
                titleCellRef.font = { bold: true };
                titleCellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
                titleCellRef.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                currentRow++;

                // Headers
                const hRow = ws.getRow(currentRow);
                const headers = ['No', '氏名', '期']; // Use standard label for header
                [0, 1, 2].forEach(i => {
                    const c = hRow.getCell(colOffset + 1 + i);
                    c.value = headers[i];
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (i === 1) c.alignment = { horizontal: 'center' };
                });
                currentRow++;

                // Data
                let currentSeq = startSeq;
                data.forEach((d, idx) => {
                    const r = ws.getRow(currentRow);
                    const c1 = r.getCell(colOffset + 1);
                    const c2 = r.getCell(colOffset + 2);
                    const c3 = r.getCell(colOffset + 3);

                    c1.value = currentSeq++;
                    c2.value = d.name;
                    c3.value = d.term;

                    // Borders
                    [c1, c2, c3].forEach(c => {
                        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    });

                    // Highlight 'Both' matches
                    if (d.isBoth) {
                        c2.font = { color: { argb: 'FFFF0000' } };
                    }
                    currentRow++;
                });

                return { nextRow: currentRow, nextSeq: currentSeq }; // No spacer row added
            };

            const startRow = 4;
            let maxRow = 4;

            // Tokyo Render
            let rT = startRow;
            let seqT = 1;
            let resT = renderBlock(rT, 0, '特進', tokyoGroups.tokushin, seqT);
            rT = resT.nextRow; seqT = resT.nextSeq;

            resT = renderBlock(rT, 0, exportTermLabel || '期生', tokyoGroups.terms, seqT);
            rT = resT.nextRow; seqT = resT.nextSeq;

            resT = renderBlock(rT, 0, '経営幹部', tokyoGroups.executive, seqT);
            rT = resT.nextRow; seqT = resT.nextSeq;

            resT = renderBlock(rT, 0, 'GoGo 55000 ご紹介', tokyoGroups.referral, seqT); // GoGo 55000 (Referral)
            rT = resT.nextRow;

            if (rT > maxRow) maxRow = rT;

            // Fukuoka Render
            let rF = startRow;
            let seqF = 1;
            let resF = renderBlock(rF, 4, '特進', fukuokaGroups.tokushin, seqF);
            rF = resF.nextRow; seqF = resF.nextSeq;

            resF = renderBlock(rF, 4, exportTermLabel || '期生', fukuokaGroups.terms, seqF);
            rF = resF.nextRow; seqF = resF.nextSeq;

            resF = renderBlock(rF, 4, '経営幹部', fukuokaGroups.executive, seqF);
            rF = resF.nextRow; seqF = resF.nextSeq;

            resF = renderBlock(rF, 4, 'GoGo 55000 ご紹介', fukuokaGroups.referral, seqF); // GoGo 55000 (Referral)
            rF = resF.nextRow;

            if (rF > maxRow) maxRow = rF;

            // Online Render
            let rO = startRow;
            let seqO = 1;
            let resO = renderBlock(rO, 8, '特進', onlineGroups.tokushin, seqO);
            rO = resO.nextRow; seqO = resO.nextSeq;

            resO = renderBlock(rO, 8, exportTermLabel || '期生', onlineGroups.terms, seqO);
            rO = resO.nextRow; seqO = resO.nextSeq;

            resO = renderBlock(rO, 8, '経営幹部', onlineGroups.executive, seqO);
            rO = resO.nextRow; seqO = resO.nextSeq;

            resO = renderBlock(rO, 8, 'GoGo 55000 ご紹介', onlineGroups.referral, seqO);
            rO = resO.nextRow;

            if (rO > maxRow) maxRow = rO;

            // Render Remarks if exists
            if (exportRemarks) {
                const remarksRow = maxRow + 2;
                ws.mergeCells(`A${remarksRow}:K${remarksRow}`);
                const remarksCell = ws.getCell(`A${remarksRow}`);
                remarksCell.value = exportRemarks;
                remarksCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                remarksCell.border = {
                    top: { style: 'medium' },
                    left: { style: 'medium' },
                    bottom: { style: 'medium' },
                    right: { style: 'medium' }
                };
                // Calculate height roughly based on newlines, default to something sufficient
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
            const uniqueApps = deduplicateApps(apps);

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

                const data = uniqueApps.filter(filterFn).map(app => {
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
                const v = a.venue || '';
                return v.includes('東京') || v.includes('tokyo') || v.includes('both');
            });
            createSheet('福岡会場', a => {
                const v = a.venue || '';
                return v.includes('福岡') || v.includes('fukuoka') || v.includes('both');
            });
            createSheet('オンライン', a => {
                if (a.participation_type === 'online') return true;
                const v = a.venue || '';
                return v.includes('LIVE') || v.includes('オンライン') || v.includes('アーカイブ');
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

    const handleTruncate = async () => {
        if (!confirm('【危険】全てのデータを削除しますか？\n（復元できません）')) return;
        setLoading(true);
        try {
            // Implementation of truncate... (Assuming simple API call)
            // Check lines 1453 for original handleDelete?
            await fetch('/api/admin/applications/truncate', { method: 'POST' });
            alert('全データを削除しました');
            fetchApplications();
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

        // Online Option Filter
        if (filterOnlineOption.size > 0) {
            // もし参加タイプがオンライン以外なら、このフィルターで除外すべきか？
            // -> はい。オンライン視聴タイプを持っているオンライン参加者を探しているため。
            // また、app.venue に視聴タイプ名が入っている前提

            // 参加タイプチェック (補完ロジックに依存)
            const pType = app.participation_type || (app.venue && ['LIVE視聴', 'アーカイブ視聴'].some((o: string) => app.venue?.includes(o)) ? 'online' : 'venue');

            if (pType !== 'online') return false;

            // 値チェック
            const v = app.venue || '';
            if (!filterOnlineOption.has(v)) return false;
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


    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
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
                <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
                    <div className="flex flex-wrap gap-4 justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => setFilter('unpaid')} className={`px-4 py-2 rounded-md ${filter === 'unpaid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>未決済</button>
                            <button onClick={() => setFilter('paid')} className={`px-4 py-2 rounded-md ${filter === 'paid' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>決済済</button>
                            <button onClick={() => setFilter('cancelled')} className={`px-4 py-2 rounded-md ${filter === 'cancelled' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>キャンセル</button>
                            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>全て</button>
                            <div className="w-px bg-gray-300 h-8 mx-2 mt-1"></div>
                            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-md bg-green-600 text-white font-bold hover:bg-green-700">新規登録</button>
                        </div>
                        {/* 統計表示 */}
                        <div className="flex gap-4 text-sm bg-gray-50 px-4 py-2 rounded border border-gray-200">
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">お申込み総数</span>
                                <span className="font-bold text-gray-800">{apps.length}</span>
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
                            <div className="w-px bg-gray-300 h-8 mx-1"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 text-xs">キャンセル</span>
                                <span className="font-bold text-gray-600">{apps.filter(a => a.payment_status === 'cancelled').length}</span>
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
                                    placeholder="月 (例: 10)"
                                    className="border rounded px-1 py-0.5 text-xs w-12 text-right"
                                    value={exportMonth}
                                    onChange={(e) => setExportMonth(e.target.value)}
                                />
                                <span className="text-xs">月</span>
                            </div>
                            <div className="flex gap-2 mb-1 justify-end items-center">
                                <span className="text-xs text-gray-500">東京</span>
                                <input
                                    type="text"
                                    placeholder="日程 (例: 15日)"
                                    className="border rounded px-1 py-0.5 text-xs w-20"
                                    value={exportTokyoDate}
                                    onChange={(e) => setExportTokyoDate(e.target.value)}
                                />
                                <span className="text-xs text-gray-500 ml-1">福岡</span>
                                <input
                                    type="text"
                                    placeholder="日程 (例: 22日)"
                                    className="border rounded px-1 py-0.5 text-xs w-20"
                                    value={exportFukuokaDate}
                                    onChange={(e) => setExportFukuokaDate(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 mb-2 justify-end items-center">
                                <span className="text-xs text-gray-500">期表記</span>
                                <input
                                    type="text"
                                    placeholder="期"
                                    className="border rounded px-1 py-0.5 text-xs w-16"
                                    value={exportTermLabel}
                                    onChange={(e) => setExportTermLabel(e.target.value)}
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
                            <button onClick={() => exportCSV(false)} className="px-4 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm w-48 mb-1">全データCSV出力</button>
                            <button onClick={() => exportCSV(true)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm w-48 mb-1">表示中のみCSV出力</button>
                            <button onClick={handleSimpleExcelExport} className="px-4 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm w-48 mb-1">簡易エクセル出力(A4)</button>
                            <button disabled className="px-4 py-1.5 bg-gray-400 text-white rounded-md cursor-not-allowed text-sm w-48">詳細エクセル出力</button>
                        </div>
                    </div>

                    {/* データリセットボタン (右端) */}
                    <div className="flex justify-end pt-2 border-t border-gray-100 mt-2">
                        <button onClick={handleTruncate} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded hover:bg-red-50" title="Ctrlキーを押しながらクリチE��">
                            データをリセット(削除)
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm">
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
                                        if (e.target.checked) setSelectedIds(new Set(sortedApps.map(a => a.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={sortedApps.length > 0 && selectedIds.size === sortedApps.length}
                                />
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('created_at')}
                            >
                                申込日時{getSortIcon('created_at')}
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('payment_status')}
                            >
                                状態{getSortIcon('payment_status')}
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('name')}
                            >
                                名前 / Email {getSortIcon('name')}
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('rank')}
                            >
                                属性 / 備考{getSortIcon('rank')}
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('generation')}
                            >
                                期{getSortIcon('generation')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">会場 / オンライン / 懇親会</th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort('total_amount')}
                            >
                                金額 / 商品名{getSortIcon('total_amount')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={9} className="px-6 py-4 text-center">読み込み中...</td></tr>
                        ) : sortedApps.length === 0 ? (
                            <tr><td colSpan={9} className="px-6 py-4 text-center">データがありません</td></tr>
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

                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <div className="text-sm font-medium text-gray-900">
                                                {app.input_name}
                                                {(nameCounts[app.input_name.trim()] || 0) > 1 && !isIgnored && (
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
                                                {/* 紹介老E��チE�� */}
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
                                            {isAlert && (
                                                <button
                                                    onClick={() => confirmProductAlert(app.id, app.tags)}
                                                    className="mt-2 text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50"
                                                >
                                                    確認済にする
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap align-top">
                                            <div className="text-sm text-gray-500">{gen}</div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                                            <div className="flex flex-col items-start gap-1">
                                                <span>¥{app.total_amount.toLocaleString()}</span>
                                                {(() => {
                                                    // receipt/page.tsx と同等の金額マッチ判定
                                                    let isMismatched = false;
                                                    const targetKeyName = `【${rankName}】${app.venue === 'both' ? '東京・福岡講演参加' : (app.venue === 'tokyo' ? '東京講演参加' : '福岡講演参加')}/${app.social_venue === 'tokyo' ? '懇親会東京のみ' : (app.social_venue === 'fukuoka' ? '懇親会福岡のみ' : (app.social_venue === 'both' ? '懇親会両方' : '懇親会なし'))}`;
                                                    const matchedLink = paymentLinksData.find(p => p.name === targetKeyName || p.key === app.payment_key);
                                                    
                                                    if (matchedLink && (Number(matchedLink.lecture_fee) > 0 || Number(matchedLink.social_fee) > 0)) {
                                                        const expectedTotal = Number(matchedLink.lecture_fee || 0) + Number(matchedLink.social_fee || 0);
                                                        if (expectedTotal !== app.total_amount) isMismatched = true;
                                                    } else {
                                                        // Fallback logic check
                                                        let expectedSocial = 0;
                                                        if (app.social_venue === 'tokyo' || app.social_venue === 'both') expectedSocial = baseSocialFeeTokyo;
                                                        else if (app.social_venue === 'fukuoka') expectedSocial = baseSocialFeeFukuoka;
                                                        
                                                        const lecture = app.total_amount - expectedSocial;
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex flex-col space-y-1 align-top">
                                            <div className="space-x-2">
                                                <button onClick={() => openEditModal(app)} className="text-indigo-600 hover:text-indigo-900">編集</button>
                                                {app.payment_status !== 'cancelled' && (
                                                    <button onClick={() => handleCancel(app.id)} className="text-red-600 hover:text-red-900">キャンセル</button>
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
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 text-indigo-700">商品名(属性/会場/懇親会を一括設定)</label>
                                    <select
                                        className="border w-full p-2 rounded"
                                        value={editForm.payment_key || ''}
                                        onChange={e => handleKeyChange(e.target.value)}
                                    >
                                        <option value="">(選択なし- 手動入力)</option>
                                        {keyCandidates.map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </div>



                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">参加会場 (講義)</label>
                                        {/* オンラインの場合はテキスト入力（またはオンラインマスタ）簡易的に自由入力とする */}
                                        {editForm.participation_type === 'online' ? (
                                            <>
                                                <input
                                                    className="border w-full p-2 rounded bg-indigo-50"
                                                    value={editForm.venue || ''}
                                                    placeholder="オンラインオプション名(例 LIVE視聴)"
                                                    onChange={(e) => handleFieldChange('venue', e.target.value)}
                                                />
                                                <input
                                                    className="border w-full p-2 rounded mt-2 bg-indigo-50"
                                                    value={editForm.online_venues || ''}
                                                    placeholder="対象会場(例 東京・福岡)"
                                                    onChange={(e) => setEditForm({...editForm, online_venues: e.target.value})}
                                                />
                                            </>
                                        ) : (
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
                                            className="border w-full p-2 rounded bg-indigo-50"
                                            value={editForm.applied_rank_name || ''}
                                            onChange={e => handleFieldChange('applied_rank_name', e.target.value)}
                                        >
                                            <option value="">(ランクなし)</option>
                                            {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 text-indigo-700">合計金額 (自動計算/上書き可)</label>
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
                                    onChange={e => setCreateForm({ ...createForm, venue: e.target.value })}
                                >
                                    <option value="">選択してください</option>
                                    <option value="東京講演参加">東京講演参加</option>
                                    <option value="福岡講演参加">福岡講演参加</option>
                                    <option value="福岡・東京講演参加">福岡・東京講演参加</option>
                                    {venueList.filter(v => v.type === 'lecture').map(v => (
                                        <option key={v.id} value={v.name}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">懇親会</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.social_venue || 'none'}
                                    onChange={e => setCreateForm({ ...createForm, social_venue: e.target.value })}
                                >
                                    <option value="none">参加しない</option>
                                    <option value="懇親会東京のみ">懇親会東京のみ</option>
                                    <option value="懇親会福岡のみ">懇親会福岡のみ</option>
                                    <option value="懇親会両方">懇親会両方</option>
                                    {venueList.filter(v => v.type === 'social').map(v => (
                                        <option key={v.id} value={v.name}>{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600">判定属性</label>
                                <select
                                    className="border w-full p-2 rounded"
                                    value={createForm.applied_rank_name || '一般'}
                                    onChange={e => setCreateForm({ ...createForm, applied_rank_name: e.target.value })}
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
                                    onChange={e => setCreateForm({ ...createForm, participation_type: e.target.value as 'venue' | 'online' })}
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
                                        onChange={e => setCreateForm({ ...createForm, ...(e.target.value ? { online_venues: e.target.value as any } : { online_venues: undefined }) })}
                                    >
                                        <option value="">選択してください</option>
                                        <option value="東京">東京</option>
                                        <option value="福岡">福岡</option>
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
        </div >
    );
}
