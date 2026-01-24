'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
                    title="商品名は変更できません。変更したい場合は削除して新規追加してください。"
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
                <input
                    className="w-full border rounded px-2 py-1 text-[10px] text-gray-500 font-mono"
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    placeholder="URL"
                />
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

                        if (val === '参加しない') {
                            newSocial = '参加しない';
                        } else if (!val) {
                            newSocial = '';
                        } else {
                            // ユーザーが懇親会で「参加しない」を選択しており、講義を有効な会場に変更した場合、懇親会をクリアします
                            if (newSocial === '参加しない') {
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

        // 重複チェック
        if (paymentLinks.some(p => p.key === name)) {
            alert('既に同じ商品名が存在します');
            return;
        }

        const addedItem: PaymentLinkItem = {
            name: name,
            key: name,
            url: newItem.url || '',
            lecture_fee: newItem.lecture_fee || '0',
            social_fee: newItem.social_fee || '0',
            venue_lecture: newItem.venue_lecture,
            venue_social: newItem.venue_social,
            rank_id: newItem.rank_id,
            product_code: newItem.product_code
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

            if (updates.name !== undefined) {
                updatedItem.key = updates.name;
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
        if (!lectureVenueName || lectureVenueName === '参加しない') return [];
        const socialVenues = venueList.filter(v => v.type === 'social');
        //const notParticipating = "参加しない"; // Handled in Component now

        // 講義が選択されていない場合、おそらくすべて返すべき？それともなし？ なしで。

        let targetNames: string[] = [];
        if (lectureVenueName.includes('・')) {
            targetNames = lectureVenueName.split('・');
        } else {
            targetNames = [lectureVenueName];
        }

        // ロジック: 選択された講義会場のいずれかに一致する懇親会会場を返しますか？ (例: "東京"講義 -> "東京"懇親会)
        // 現在のロジック: 講義会場名が含まれる、または文字列の一部であるものを確認します。
        // 広げましょう: すべての懇親会会場を返しますか？ ユーザーがフィルタリングできます。
        // 厳密なフィルタを作成すると、名前が不一致の場合に面倒になる可能性があります。
        // しかし、以前のリクエストでは「排他制御」が求められました。
        // 「参加しないを選ぶと登録された会場は選択できない」 -> "参加しない" ロジックがこれを処理します。
        // 「東京を選ぶ -> 福岡の懇親会を選べない」?
        // 名前の包含でフィルタリングしましょう。

        // 講義ターゲットの1つと同じ名前を持つ、またはそれに含まれる懇親会会場をフィルタリングします。
        // これは命名規則に依存しています。「東京」講義 -> 「東京」懇親会。

        return socialVenues.filter(sv => {
            // 懇親会会場名がターゲットリストに完全に含まれている場合
            // または、懇親会会場名がターゲットの1つを含んでいる場合 (例: "東京懇親会" は "東京" を含む)
            return targetNames.some(tn => sv.name.includes(tn) || tn.includes(sv.name));
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPaymentLinks((items) => {
                const oldIndex = items.findIndex((item) => item.name === active.id); // 名前をIDとして使用
                const newIndex = items.findIndex((item) => item.name === over.id);
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

        if (!confirm('CSVをインポートして一覧に追加・更新しますか？\\n※反映するにはインポート後に画面下の「設定を保存する」を押す必要があります。')) return;

        const text = await file.text();
        const cleanText = text.replace(/^\\uFEFF/, '');
        const lines = cleanText.split(/\\r?\\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        // マッピング
        const headerMap: Record<string, string> = {
            '商品名': 'name', '商品コード': 'product_code', 'URL': 'url',
            '属性ID': 'rank_id', '講義会場': 'venue_lecture', '懇親会会場': 'venue_social',
            '受講料': 'lecture_fee', '懇親会費': 'social_fee'
        };

        const mappedHeaders = headers.map(h => headerMap[h] || h);

        const newItems: PaymentLinkItem[] = [];

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (vals.length < mappedHeaders.length) continue;

            const obj: any = {};
            mappedHeaders.forEach((h, idx) => obj[h] = vals[idx]);

            if (!obj.name) continue;

            newItems.push({
                name: obj.name,
                key: obj.name,
                product_code: obj.product_code,
                url: obj.url,
                rank_id: obj.rank_id,
                venue_lecture: obj.venue_lecture,
                venue_social: obj.venue_social,
                lecture_fee: obj.lecture_fee || '0',
                social_fee: obj.social_fee || '0'
            });
        }

        // マージロジック: 名前が存在する場合は更新、存在しない場合は追加
        // ローカルで行います。
        const merged = [...paymentLinks];
        let addedCount = 0;
        let updatedCount = 0;

        newItems.forEach(newItem => {
            const idx = merged.findIndex(p => p.name === newItem.name);
            if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...newItem };
                updatedCount++;
            } else {
                merged.push(newItem);
                addedCount++;
            }
        });

        setPaymentLinks(merged);
        alert(`インポート完了: 追加 ${addedCount}件, 更新 ${updatedCount}件\\n内容を確認し、問題なければ「設定を保存する」ボタンを押してください。`);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">商品マスタ管理 (決済リンク設定)</h1>
                    <div className="flex gap-4 items-center">
                        <button onClick={handleExport} className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm">CSVエクスポート</button>
                        <label className="cursor-pointer px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center">
                            CSVインポート (編集)
                            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                        </label>
                        <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600 flex items-center">
                            ← ダッシュボードに戻る
                        </Link>
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

                                    if (val === '参加しない') {
                                        newSocial = '参加しない';
                                    } else if (!val) {
                                        newSocial = '';
                                    } else {
                                        if (newSocial === '参加しない') {
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
