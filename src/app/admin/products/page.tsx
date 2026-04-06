'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSocialOptionsForLecture } from '@/lib/venueUtils';
import * as XLSX from 'xlsx';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProductMaster {
    names: string[];
    venues: string[];
    socials: string[];
    lecture_venues?: string[];
    social_venues?: string[];
}

interface Venue {
    id: number;
    name: string;
    type: 'lecture' | 'social';
    isOnline?: boolean;
}

interface PaymentLinkItem {
    name: string;
    lecture_fee: string;
    social_fee: string;
    key: string;
    url: string;
    venue_lecture?: string;
    venue_social?: string;
    rank_id?: string;
    product_code?: string;
}

interface Rank {
    id: number;
    name: string;
}

// 並び替え可能な行コンポーネント
// 複数選択用のヘルパーコンポーネント
// 複数選択用のヘルパーコンポーネント (修正版: detailsタグを使用せず、確実な制御を行う)
import { useRef } from 'react';

// 一意なキー（複合キー）を生成する共通関数
const generateProductKey = (p: Partial<PaymentLinkItem>) => {
    return `${p.name || ''}|${p.rank_id || ''}|${p.venue_lecture || ''}|${p.venue_social || ''}`;
};

function MultiSelectVenue({
    value,
    options,
    onChange
}: {
    value: string,
    options: Venue[],
    onChange: (val: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // 値は "東京・大阪" や "参加しない" のような文字列です
    const selectedValues = value ? value.split('・').filter(s => s) : [];
    const notParticipating = "参加しない";

    // 外側クリックで閉じる処理
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, optionName: string) => {
        const checked = e.target.checked;
        let newSelected = [...selectedValues];

        if (optionName === notParticipating) {
            if (checked) {
                newSelected = [notParticipating]; // 排他制御
            } else {
                newSelected = newSelected.filter(v => v !== notParticipating);
            }
        } else {
            if (checked) {
                // 通常の会場を選択した場合、'参加しない' を削除します
                newSelected = newSelected.filter(v => v !== notParticipating);
                newSelected.push(optionName);
            } else {
                newSelected = newSelected.filter(v => v !== optionName);
            }
        }

        // 重複を削除して結合
        const unique = Array.from(new Set(newSelected));
        onChange(unique.join('・'));
        // チェックボックス操作時は閉じない (意図的にここでの setIsOpen(false) は行わない)
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="cursor-pointer flex items-center justify-between border rounded px-2 py-1 bg-white text-xs min-h-[26px]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="block text-left" title={value}>
                    {value || <span className="text-gray-400">(選択)</span>}
                </span>
                <span className="text-[8px] text-gray-500 ml-1">▼</span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-48 bg-white border rounded shadow-lg p-2 max-h-60 overflow-y-auto">
                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        {/* 「参加しない」は固定で表示 */}
                        <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                                type="checkbox"
                                value={notParticipating}
                                checked={selectedValues.includes(notParticipating)}
                                onChange={(e) => handleChange(e, notParticipating)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <span className="text-sm text-gray-700 font-bold">
                                {notParticipating}
                            </span>
                        </label>

                        <div className="border-t my-1"></div>

                        {options.map(opt => (
                            <label key={opt.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input
                                    type="checkbox"
                                    value={opt.name}
                                    checked={selectedValues.includes(opt.name)}
                                    onChange={(e) => handleChange(e, opt.name)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <span className={`text-sm ${opt.isOnline ? 'text-blue-800' : 'text-gray-700'}`}>
                                    {opt.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableRow({
    id,
    item,
    index,
    ranks,
    venueList,
    getSocialOptions,
    updateItem,
    handleDelete
}: {
    id: string,
    item: PaymentLinkItem,
    index: number,
    ranks: Rank[],
    venueList: Venue[],
    getSocialOptions: (v: string) => Venue[],
    updateItem: (idx: number, updates: Partial<PaymentLinkItem>) => void,
    handleDelete: (idx: number) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: id }); // 名前（またはキー）をIDとして使用します。一意である必要があります。

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 bg-white group border-b">
            <td className="p-2 align-middle text-center cursor-grab" {...attributes} {...listeners}>
                <span className="text-gray-300 group-hover:text-gray-500 font-bold text-lg">⋮⋮</span>
            </td>
            <td className="p-2 align-top">
                <input
                    className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-500 cursor-not-allowed"
                    value={item.name}
                    readOnly
                    title={item.name}
                />
            </td>
            <td className="p-2 align-top">
                <input
                    className="w-full border rounded px-2 py-1 bg-white text-gray-600 font-mono"
                    value={item.product_code || ''}
                    onChange={(e) => updateItem(index, { product_code: e.target.value })}
                    placeholder="管理コード"
                />
            </td>
            <td className="p-2 align-top">
                <div className="flex items-center gap-1">
                    <input
                        className="flex-1 border rounded px-2 py-1 text-[10px] text-gray-500 font-mono w-full min-w-0"
                        value={item.url}
                        onChange={(e) => updateItem(index, { url: e.target.value })}
                        placeholder="URL"
                    />
                    {item.url && (
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="リンク先を確認（別タブで開く）"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </a>
                    )}
                </div>
            </td>
            <td className="p-2 align-top">
                <select className="w-full border rounded px-1 py-1 text-xs" value={item.rank_id || ''} onChange={(e) => updateItem(index, { rank_id: e.target.value })}>
                    <option value="">-</option>
                    {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </td>
            <td className="p-2 align-top">
                <MultiSelectVenue
                    value={item.venue_lecture || ''}
                    options={venueList.filter(v => v.type === 'lecture')}
                    onChange={(val) => {
                        let newSocial = item.venue_social;

                        // オンライン判定
                        const selectedNames = val.split('・');
                        const onlineVenues = venueList.filter(v => v.isOnline).map(v => v.name);
                        const physicalVenues = venueList.filter(v => !v.isOnline && v.type === 'lecture').map(v => v.name);

                        const hasOnline = selectedNames.some(name => onlineVenues.includes(name));
                        const hasPhysical = selectedNames.some(name => physicalVenues.includes(name));

                        // オンラインが含まれていて、かつ物理会場が含まれていない場合のみ「ー」にする
                        if (hasOnline && !hasPhysical) {
                            newSocial = 'ー';
                        } else if (val === '参加しない') {
                            newSocial = '参加しない';
                        } else if (!val) {
                            newSocial = '';
                        } else {
                            if (newSocial === '参加しない' || newSocial === 'ー') {
                                newSocial = '';
                            }
                        }

                        updateItem(index, {
                            venue_lecture: val,
                            venue_social: newSocial
                        });
                    }}
                />
            </td>
            <td className="p-2 align-top">
                <MultiSelectVenue
                    value={item.venue_social || ''}
                    options={getSocialOptions(item.venue_lecture || '')} // このロジックは複数講義会場をサポートする必要があります
                    onChange={(val) => updateItem(index, { venue_social: val })}
                />
            </td>
            <td className="p-2 align-top">
                <input type="number" className="w-full border rounded px-1 py-1 text-right text-xs" value={item.lecture_fee} onChange={(e) => updateItem(index, { lecture_fee: e.target.value })} />
            </td>
            <td className="p-2 align-top">
                <input type="number" className="w-full border rounded px-1 py-1 text-right text-xs" value={item.social_fee} onChange={(e) => updateItem(index, { social_fee: e.target.value })} />
            </td>
            <td className="p-2 text-center align-top">
                <button onClick={() => handleDelete(index)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
            </td>
        </tr>
    );
}

export default function ProductMasterPage() {
    const [master, setMaster] = useState<ProductMaster>({ names: [], venues: [], socials: [], lecture_venues: [], social_venues: [] });
    const [venueList, setVenueList] = useState<Venue[]>([]);
    const [ranks, setRanks] = useState<Rank[]>([]);
    const [paymentLinks, setPaymentLinks] = useState<PaymentLinkItem[]>([]);
    const [urlPrefix, setUrlPrefix] = useState('');
    const [urlSuffix, setUrlSuffix] = useState('');
    const [loading, setLoading] = useState(true);

    const [newItem, setNewItem] = useState<Partial<PaymentLinkItem>>({
        name: '',
        url: '',
        lecture_fee: '0',
        social_fee: '0',
        venue_lecture: '',
        venue_social: '',
        rank_id: '',
        product_code: ''
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const [res, venuesRes, ranksRes, onlineRes] = await Promise.all([
                fetch('/api/admin/settings'),
                fetch('/api/admin/venues'),
                fetch('/api/admin/ranks'),
                fetch('/api/admin/online-options')
            ]);

            if (res.ok) {
                const data = await res.json();
                const settings = data;

                let mergedVenues: Venue[] = [];

                // Venue List
                if (venuesRes.ok) {
                    const vData = await venuesRes.json();
                    mergedVenues = [...vData];
                }

                // Online Options (merged as 'lecture' type for selection purposes, but distinguished by name)
                if (onlineRes.ok) {
                    const oData = await onlineRes.json();
                    const onlineVenues = oData.map((o: any) => ({
                        id: 1000 + o.id, // Offset ID to avoid conflict
                        name: o.name,
                        type: 'lecture', // Treat as lecture for dropdown
                        isOnline: true
                    }));
                    mergedVenues = [...mergedVenues, ...onlineVenues];
                }

                setVenueList(mergedVenues);

                if (ranksRes.ok) {
                    setRanks(await ranksRes.json());
                }

                // マスタ読み込み
                const loadedMaster = settings.product_name_master || { names: [], venues: [], socials: [] };
                const venueMaster = settings.venue_master || { lecture_venues: [], social_venues: [] };

                setMaster({
                    names: Array.isArray(loadedMaster.names) ? loadedMaster.names : [],
                    venues: Array.isArray(loadedMaster.venues) ? loadedMaster.venues : [],
                    socials: Array.isArray(loadedMaster.socials) ? loadedMaster.socials : [],
                    lecture_venues: Array.isArray(venueMaster.lecture_venues) ? venueMaster.lecture_venues : [],
                    social_venues: Array.isArray(venueMaster.social_venues) ? venueMaster.social_venues : []
                });

                // 支払いリンク読み込み
                let linksArr: PaymentLinkItem[] = [];
                const val = settings.payment_links;

                if (Array.isArray(val)) {
                    linksArr = val.map((item: any) => ({
                        name: item.name || '',
                        lecture_fee: String(item.lecture_fee || 0),
                        social_fee: String(item.social_fee || 0),
                        key: item.key || '', // 名前と同期されます
                        url: item.url || '',
                        venue_lecture: item.venue_lecture || '',
                        venue_social: item.venue_social || '',
                        rank_id: item.rank_id || '',
                        product_code: item.product_code || ''
                    }));
                } else if (val) {
                    // 旧フォーマットサポート
                    linksArr = Object.entries(val).map(([key, value]) => ({
                        name: key,
                        lecture_fee: '0',
                        social_fee: '0',
                        key: key,
                        url: String(value)
                    }));
                }
                setPaymentLinks(linksArr);
                setUrlPrefix(settings.url_prefix || '');
                setUrlSuffix(settings.url_suffix || '');
            }
        } catch (e) {
            console.error(e);
            alert('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const generateUrl = (code: string) => {
        return `${urlPrefix}${code}${urlSuffix}`;
    };

    const executeSave = async (linksToSave: PaymentLinkItem[], silent = false) => {
        try {
            // 1. 支払いリンクを準備
            const saveLinks = linksToSave.map(item => ({
                name: item.name,
                key: item.name, // キーが名前と一致することを確認
                url: item.url,
                lecture_fee: Number(item.lecture_fee),
                social_fee: Number(item.social_fee),
                venue_lecture: item.venue_lecture,
                venue_social: item.venue_social,
                rank_id: item.rank_id,
                product_code: item.product_code
            }));

            // 2. 商品マスタ名を準備 (キーと順序を同期)
            const saveMaster = {
                ...master,
                names: saveLinks.map(l => l.name) // ここで順序が保持されます！
            };

            const payload = {
                product_name_master: saveMaster,
                payment_links: saveLinks
            };

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, url_prefix: urlPrefix, url_suffix: urlSuffix })
            });

            if (res.ok) {
                if (!silent) alert('保存しました');
                fetchSettings(); // Reload to confirm
                return true;
            } else {
                alert('保存に失敗しました');
                return false;
            }
        } catch (e) {
            console.error(e);
            alert('エラーが発生しました');
            return false;
        }
    };

    const handleAddItem = async () => {
        const name = newItem.name?.trim();
        if (!name) return;

        // 複合キーによる重複チェック
        const key = generateProductKey({
            name: name,
            rank_id: newItem.rank_id,
            venue_lecture: newItem.venue_lecture,
            venue_social: newItem.venue_social
        });
        if (paymentLinks.some(p => p.key === key)) {
            alert('同じ商品名・属性・会場の組み合わせが既に存在します');
            return;
        }

        const addedItem: PaymentLinkItem = {
            name: name,
            key: key,
            url: newItem.url || '',
            lecture_fee: newItem.lecture_fee || '0',
            social_fee: newItem.social_fee || '0',
            venue_lecture: newItem.venue_lecture || '',
            venue_social: newItem.venue_social || '',
            rank_id: newItem.rank_id || '',
            product_code: newItem.product_code || ''
        };

        const newLinks = [...paymentLinks, addedItem];
        setPaymentLinks(newLinks);

        // 即時保存実行
        // ※ UI上のフィードバックのため、silent=false（アラート出す）にします
        const success = await executeSave(newLinks, false);

        if (success) {
            setNewItem({ name: '', url: '', lecture_fee: '0', social_fee: '0', venue_lecture: '', venue_social: '', rank_id: '', product_code: '' });
        }
    };

    const handleDelete = (index: number) => {
        if (!confirm('本当に削除しますか？\n(既にこの商品名を使用している申込データには影響しませんが、新規選択できなくなります)')) return;
        const newData = [...paymentLinks];
        newData.splice(index, 1);
        setPaymentLinks(newData);
    };

    const updateItem = (index: number, updates: Partial<PaymentLinkItem>) => {
        setPaymentLinks(prevLinks => {
            const newData = [...prevLinks];
            const currentItem = newData[index];
            const updatedItem = { ...currentItem, ...updates };

            if (updates.name !== undefined || updates.rank_id !== undefined || updates.venue_lecture !== undefined || updates.venue_social !== undefined) {
                updatedItem.key = generateProductKey(updatedItem);
            }

            // コード変更時にURLを自動生成
            if (updates.product_code !== undefined) {
                updatedItem.url = generateUrl(updates.product_code);
            }

            newData[index] = updatedItem;
            return newData;
        });
    };

    const handleSave = async () => {
        if (!confirm('変更を保存しますか？')) return;
        await executeSave(paymentLinks);
    };

    const getSocialOptions = (lectureVenueName: string) => {
        const socialVenues = venueList.filter(v => v.type === 'social');
        return getSocialOptionsForLecture(lectureVenueName, socialVenues);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPaymentLinks((items) => {
                const oldIndex = items.findIndex((item) => item.key === active.id); // 複合キーをIDとして使用
                const newIndex = items.findIndex((item) => item.key === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleExport = () => {
        const headers = [
            '商品名', '商品コード', 'URL', '属性ID',
            '講義会場', '懇親会会場', '受講料', '懇親会費'
            // インポートの観点からは冗長な生成されたキー/URLを除外しますが、エクスポートには役立ちます
        ];
        // 注: 内部のランクIDをエクスポートすると、ユーザーが編集するのが難しいかもしれません
        // ランク名をエクスポートした方が良いでしょうか？その方が良いですが、インポートのためにマップし直す必要があります。
        // 参考のためにランク名もエクスポートしましょうか？
        // それともシンプルに: IDをエクスポートします。
        // ユーザーのリクエストは「エクスポート/インポート」です。
        // 生の値をエクスポートしましょう。

        const rows = paymentLinks.map(p => [
            p.name, p.product_code || '', p.url, p.rank_id || '',
            p.venue_lecture || '', p.venue_social || '',
            p.lecture_fee, p.social_fee
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `products_master_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];
        e.target.value = '';

        if (!confirm('CSV または Excelファイルをインポートして一覧に追加・更新しますか？\n※反映するにはインポート後に画面下の「設定を保存する」を押す必要があります。')) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            const isCSV = file.name.toLowerCase().endsWith('.csv');

            let workbook;
            if (isCSV) {
                // CSVの場合は UTF-8 か Shift-JIS かを判定して読み込む
                let content = '';
                try {
                    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
                    content = utf8Decoder.decode(uint8);
                } catch (e) {
                    const sjisDecoder = new TextDecoder('shift-jis');
                    content = sjisDecoder.decode(uint8);
                }
                workbook = XLSX.read(content, { type: 'string' });
            } else {
                // Excel (.xlsx) の場合はバイナリとして読み込む
                workbook = XLSX.read(arrayBuffer, { type: 'array' });
            }

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (!jsonData || jsonData.length === 0) {
                alert('データが見つかりませんでした');
                return;
            }

            // ヘッダーマッピングの強化版（空白・大文字小文字・類似語を許容）
            const normalize = (s: string) => s.trim().replace(/\s+/g, '').replace(/　/g, '');
            const headerAliases: Record<string, string> = {
                '商品名': 'name', '名称': 'name', '項目名': 'name',
                '商品コード': 'product_code', 'コード': 'product_code', '管理コード': 'product_code',
                'URL': 'url', 'リンク': 'url', '決済リンク': 'url',
                '属性ID': 'rank_id', 'ランクID': 'rank_id', '対象ID': 'rank_id',
                '講義会場': 'venue_lecture', '会場': 'venue_lecture', '講義': 'venue_lecture',
                '懇親会会場': 'venue_social', '懇親会': 'venue_social', '宴会': 'venue_social',
                '受講料': 'lecture_fee', '金額': 'lecture_fee', '講義費': 'lecture_fee',
                '懇親会費': 'social_fee', '宴会費': 'social_fee'
            };

            const newItems: PaymentLinkItem[] = (jsonData as any[]).map(row => {
                const obj: any = {};
                // キー（日本語ヘッダー）を内部用キーに変換
                Object.entries(row).forEach(([k, v]) => {
                    const cleanK = normalize(k);
                    const mappedKey = headerAliases[cleanK] || cleanK;
                    obj[mappedKey] = v;
                });

                if (!obj.name) return null;

                const item: any = {
                    name: String(obj.name).trim(),
                    product_code: obj.product_code ? String(obj.product_code).trim() : '',
                    url: obj.url ? String(obj.url).trim() : '',
                    rank_id: obj.rank_id ? String(obj.rank_id).trim() : '',
                    venue_lecture: obj.venue_lecture ? String(obj.venue_lecture).trim() : '',
                    venue_social: obj.venue_social ? String(obj.venue_social).trim() : '',
                    lecture_fee: String(obj.lecture_fee || '0'),
                    social_fee: String(obj.social_fee || '0')
                };

                // インポート時に一意なキーを生成
                item.key = generateProductKey(item);
                return item as PaymentLinkItem;
            }).filter(Boolean) as PaymentLinkItem[];

            if (newItems.length === 0) {
                const detectedHeaders = jsonData.length > 0 ? Object.keys(jsonData[0] as object).join(', ') : 'なし';
                alert(`取り込み可能な有効なデータがありませんでした。\n\n【原因のヒント】\nファイル内の「商品名」列が正しく認識されていない可能性があります。\n\n検出された項目名: [${detectedHeaders}]\n※ガイドに記載の項目名と一致しているかご確認ください。`);
                return;
            }

            // マージロジック
            const merged = [...paymentLinks];
            let addedCount = 0;
            let updatedCount = 0;

            newItems.forEach(newItem => {
                const idx = merged.findIndex(p => p.key === newItem.key);
                if (idx >= 0) {
                    merged[idx] = { ...merged[idx], ...newItem };
                    updatedCount++;
                } else {
                    merged.push(newItem);
                    addedCount++;
                }
            });

            setPaymentLinks(merged);
            alert(`インポート完了: 追加 ${addedCount}件, 更新 ${updatedCount}件\n内容を確認し、問題なければ「設定を保存する」ボタンを押してください。`);

        } catch (error) {
            console.error('Import error:', error);
            alert('ファイルの読み込み中にエラーが発生しました');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">商品マスタ管理 (決済リンク設定)</h1>
                    <div className="flex gap-4 items-center">
                        <button onClick={handleExport} className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm">CSVエクスポート</button>
                        <label className="cursor-pointer px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center">
                            CSVインポート
                            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                        </label>
                        <Link href="/admin/dashboard" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                            ← ダッシュボードへ
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-900 border border-blue-200 shadow-sm transition-all hover:border-blue-300">
                        <details>
                            <summary className="font-bold cursor-pointer hover:text-blue-700 select-none flex items-center gap-2 outline-none">
                                <span className="text-xl">📘</span>
                                <span>CSV / Excel インポート操作ガイド（インポート前にご確認ください）</span>
                            </summary>
                            <div className="mt-4 space-y-4 pl-4 border-l-2 border-blue-200 animate-fade-in text-gray-700">
                                <div>
                                    <p className="font-bold text-blue-800 mb-1">■ 推奨フォーマット</p>
                                    <p>`.xlsx (Excel)` または `.csv (UTF-8)`</p>
                                </div>
                                <div>
                                    <p className="font-bold text-blue-800 mb-1">■ 1行目（ヘッダー項目名）</p>
                                    <p>以下の項目名が認識されます：</p>
                                    <ul className="list-disc pl-5 mt-1 text-xs grid grid-cols-2 gap-1">
                                        <li><strong>商品名</strong> (必須/更新キー)</li>
                                        <li><strong>受講料</strong> (必須)</li>
                                        <li><strong>懇親会費</strong> (必須)</li>
                                        <li><strong>商品コード</strong> (任意)</li>
                                        <li><strong>講義会場</strong> (任意)</li>
                                        <li><strong>懇親会会場</strong> (任意)</li>
                                        <li><strong>属性ID</strong> (任意)</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-bold text-blue-800 mb-1">■ 各項目の書き方ルール</p>
                                    <ul className="list-disc pl-5 text-xs space-y-2">
                                        <li><strong>データの識別</strong>: 「<strong>商品名・属性ID・講義会場・懇親会会場</strong>」の組み合わせが完全に一致する場合にのみ、既存データの上書き更新となります。それ以外（例：同じ名前で会場だけが違う）は別々の商品として新規登録されます。</li>
                                        <li><strong>会場の複数指定</strong>: 複数の会場を許可する場合、「<strong>東京・福岡</strong>」のように「<strong>・</strong>（中黒）」で繋いでください。</li>
                                        <li><strong>会場名の特殊指定</strong>: 「<strong>参加しない</strong>」または「<strong>ー</strong>（全角ダッシュ）」が使用可能です。オンラインのみの場合は、講義会場に「<strong>オンライン</strong>」、懇親会会場に「<strong>ー</strong>」を指定するのが一般的です。</li>
                                        <li><strong>属性ID</strong>: 属性管理画面で設定されている数値（1, 2...）を直接指定します。空欄の場合は「一般（属性なし）」扱いとなります。</li>
                                    </ul>
                                </div>
                                <div className="bg-amber-50 p-2 rounded border border-amber-100 text-[11px]">
                                    <p className="font-bold text-amber-800">⚠️ インポート後の注意</p>
                                    <p>ファイルを取り込んだ直後は画面上の表示が更新されるだけで、データベースには保存されていません。必ず最後に画面右下の「<strong>設定を保存する</strong>」ボタンを押して確定させてください。</p>
                                </div>
                            </div>
                        </details>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-900 border border-blue-200 shadow-sm transition-all hover:border-blue-300">
                    <details>
                        <summary className="font-bold cursor-pointer hover:text-blue-700 select-none flex items-center gap-2 outline-none">
                            <span className="text-xl">💡</span>
                            <span>決済リンクの自動マッチング仕様について（クリックで開く）</span>
                        </summary>
                        <div className="mt-3 space-y-2 pl-4 border-l-2 border-blue-200 animate-fade-in">
                            <p>お客様のお申し込み内容に基づいて、以下の<strong>3つの条件がすべて完全に一致する</strong>商品（決済リンク）が自動的に選択されます。</p>
                            <ul className="list-disc pl-5 space-y-1 my-2">
                                <li><strong>講義会場</strong>: 申し込み時に選択された会場と一致（「参加しない」も会場名として扱われます）</li>
                                <li><strong>懇親会会場</strong>: 申し込み時に選択された会場と一致（オンライン参加の場合は「ー」）</li>
                                <li><strong>属性</strong>: 受講生の場合は登録属性、一般参加の場合は「属性なし（空欄）」または「一般」として設定された商品</li>
                            </ul>
                            <div className="bg-white p-3 rounded border border-blue-100 mt-2">
                                <p className="font-bold mb-1 text-xs text-gray-500">注意点</p>
                                <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                                    <li>条件に一致する商品が見つからない場合、自動返信メールには決済リンクが記載されず、事務局確認となります。</li>
                                </ul>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-6 bg-blue-50 p-4 rounded text-sm text-blue-800">
                        <ul className="list-disc pl-5">
                            <li>商品名、コード、金額等を設定します。</li>
                            <li><strong>リスト左端の「⋮⋮」をドラッグ</strong>して並び順を変更できます。</li>
                            <li>会場はドロップダウンから<strong>複数選択可能</strong>です。「参加しない」を選択すると他の会場は解除されます。</li>
                            <li className="text-red-600 font-bold">※商品名は変更できません。変更したい場合は削除して新規追加してください（過去データへの影響を防ぐため）。</li>
                        </ul>
                    </div>

                    {/* URL Settings */}
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-100 rounded border border-gray-200">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">決済リンク前半</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded"
                                placeholder="例: https://payment.example.com/"
                                value={urlPrefix}
                                onChange={e => setUrlPrefix(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">決済リンク後半</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded"
                                placeholder="例: ?params=..."
                                value={urlSuffix}
                                onChange={e => setUrlSuffix(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* New Item Form */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-6 p-4 bg-gray-50 rounded border">
                        <div className="col-span-3">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">商品名 (管理用)</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded"
                                placeholder="例: 神言学 基礎コース (一般/東京)"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">商品コード</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded bg-white text-gray-600 font-mono"
                                placeholder="Code"
                                value={newItem.product_code || ''}
                                onChange={e => {
                                    const code = e.target.value;
                                    setNewItem({
                                        ...newItem,
                                        product_code: code,
                                        url: generateUrl(code)
                                    });
                                }}
                            />
                        </div>
                        <div className="col-span-5">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">決済リンクURL (自動生成)</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded bg-gray-50 text-gray-600 font-mono"
                                placeholder="自動生成されます"
                                value={newItem.url}
                                onChange={e => setNewItem({ ...newItem, url: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">対象属性</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={newItem.rank_id || ''}
                                onChange={e => setNewItem({ ...newItem, rank_id: e.target.value })}
                            >
                                <option value="">(選択なし)</option>
                                {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2 md:col-start-1">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">講義会場</label>
                            <MultiSelectVenue
                                value={newItem.venue_lecture || ''}
                                options={venueList.filter(v => v.type === 'lecture')}
                                onChange={(val) => {
                                    let newSocial = newItem.venue_social;

                                    // オンライン判定: 選択された値にオンライン会場が含まれているか
                                    const selectedNames = val.split('・');
                                    const onlineVenues = venueList.filter(v => v.isOnline).map(v => v.name);
                                    const physicalVenues = venueList.filter(v => !v.isOnline && v.type === 'lecture').map(v => v.name);

                                    const hasOnline = selectedNames.some(name => onlineVenues.includes(name));
                                    const hasPhysical = selectedNames.some(name => physicalVenues.includes(name));

                                    // オンラインが含まれていて、かつ物理会場が含まれていない場合のみ「ー」にする
                                    if (hasOnline && !hasPhysical) {
                                        newSocial = 'ー';
                                    } else if (val === '参加しない') {
                                        newSocial = '参加しない';
                                    } else if (!val) {
                                        newSocial = '';
                                    } else {
                                        // ユーザーが「参加しない」または「ー」を選択していたが、有効な物理会場が追加された場合などはクリアして再選択を促す
                                        // ただし、物理会場がある場合はその会場に対応する懇親会を選べるようにするため、
                                        // ここでの強制クリアは「不適切な値が残っている場合」に限るべきですが、
                                        // シンプルに「参加しない」「ー」から物理ありに変わったときはクリアで良いでしょう。
                                        if (newSocial === '参加しない' || newSocial === 'ー') {
                                            newSocial = '';
                                        }
                                    }

                                    setNewItem({
                                        ...newItem,
                                        venue_lecture: val,
                                        venue_social: newSocial
                                    });
                                }}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">懇親会会場</label>
                            <MultiSelectVenue
                                value={newItem.venue_social || ''}
                                options={getSocialOptions(newItem.venue_lecture || '')}
                                onChange={(val) => setNewItem({ ...newItem, venue_social: val })}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">受講料</label>
                            <input type="number" className="w-full border p-2 rounded" value={newItem.lecture_fee} onChange={e => setNewItem({ ...newItem, lecture_fee: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">懇親会費</label>
                            <input type="number" className="w-full border p-2 rounded" value={newItem.social_fee} onChange={e => setNewItem({ ...newItem, social_fee: e.target.value })} />
                        </div>

                        <div className="col-span-2 pt-5 md:col-start-11">
                            <button onClick={handleAddItem} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 font-bold">追加</button>
                        </div>
                    </div>

                    <div className="border rounded">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-600 text-sm">
                                <tr>
                                    <th className="p-3 border-b w-[50px] text-center">移動</th>
                                    <th className="p-3 border-b w-[15%]">商品名</th>
                                    <th className="p-3 border-b w-[15%]">商品コード</th>
                                    <th className="p-3 border-b w-[15%]">決済リンクURL</th>
                                    <th className="p-3 border-b w-[10%]">属性</th>
                                    <th className="p-3 border-b w-[8%]">講義</th>
                                    <th className="p-3 border-b w-[8%]">懇親会</th>
                                    <th className="p-3 border-b w-[8%]">受講料</th>
                                    <th className="p-3 border-b w-[8%]">宴会費</th>
                                    <th className="p-3 border-b w-[5%] text-center">削除</th>
                                </tr>
                            </thead>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <tbody className="divide-y">
                                    <SortableContext
                                        items={paymentLinks.map(p => p.key)} // キー/名前をIDとして使用
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {loading ? (
                                            <tr><td colSpan={10} className="p-4 text-center">Loading...</td></tr>
                                        ) : paymentLinks.length === 0 ? (
                                            <tr><td colSpan={10} className="p-4 text-center text-gray-400">登録データはありません</td></tr>
                                        ) : (
                                            paymentLinks.map((item, idx) => (
                                                <SortableRow
                                                    key={item.key} // 一意なキー
                                                    id={item.key}
                                                    item={item}
                                                    index={idx}
                                                    ranks={ranks}
                                                    venueList={venueList}
                                                    getSocialOptions={getSocialOptions}
                                                    updateItem={updateItem}
                                                    handleDelete={handleDelete}
                                                />
                                            ))
                                        )}
                                    </SortableContext>
                                </tbody>
                            </DndContext>
                        </table>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded hover:bg-blue-700 font-bold shadow-lg">
                            設定を保存する
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
