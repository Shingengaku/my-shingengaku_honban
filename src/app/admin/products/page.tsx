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

// Sortable Row Component
// Helper component for Multi-Select
function MultiSelectVenue({
    value,
    options,
    onChange
}: {
    value: string,
    options: Venue[],
    onChange: (val: string) => void
}) {
    // value is string like "東京・大阪" or "参加しない"
    const selectedValues = value ? value.split('・').filter(s => s) : [];
    const notParticipating = "参加しない";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, optionName: string) => {
        const checked = e.target.checked;
        let newSelected = [...selectedValues];

        if (optionName === notParticipating) {
            if (checked) {
                newSelected = [notParticipating]; // Exclusive
            } else {
                newSelected = newSelected.filter(v => v !== notParticipating);
            }
        } else {
            if (checked) {
                // If checking a normal venue, remove 'notParticipating'
                newSelected = newSelected.filter(v => v !== notParticipating);
                newSelected.push(optionName);
            } else {
                newSelected = newSelected.filter(v => v !== optionName);
            }
        }

        // Remove duplicates and join
        const unique = Array.from(new Set(newSelected));
        onChange(unique.join('・'));
    };

    return (
        <details className="relative">
            <summary className="cursor-pointer list-none flex items-center justify-between border rounded px-2 py-1 bg-white text-xs min-h-[26px]">
                <span className="truncate max-w-[100px] block" title={value}>
                    {value || <span className="text-gray-400">(選択)</span>}
                </span>
                <span className="text-[8px] text-gray-500 ml-1">▼</span>
            </summary>
            <div className="absolute top-full left-0 z-50 mt-1 w-48 bg-white border rounded shadow-lg p-2 max-h-60 overflow-y-auto">
                <div className="space-y-1">
                    {options.map(opt => (
                        <label key={opt.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                                type="checkbox"
                                value={opt.name}
                                checked={selectedValues.includes(opt.name)}
                                onChange={(e) => handleChange(e, opt.name)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <span className="text-sm text-gray-700">{opt.name}</span>
                        </label>
                    ))}
                    <div className="border-t my-1"></div>
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                            type="checkbox"
                            value={notParticipating}
                            checked={selectedValues.includes(notParticipating)}
                            onChange={(e) => handleChange(e, notParticipating)}
                            className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                        />
                        <span className="text-sm text-red-600 font-bold">{notParticipating}</span>
                    </label>
                </div>
            </div>
        </details>
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
    } = useSortable({ id: id }); // Using name (or key) as ID. Must be unique.

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
                <input className="w-full border rounded px-2 py-1" value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} />
            </td>
            <td className="p-2 align-top">
                <input
                    className="w-full border rounded px-2 py-1 bg-white text-gray-600 font-mono"
                    value={item.product_code || ''}
                    onChange={(e) => updateItem(index, { product_code: e.target.value })}
                    placeholder="Code"
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
                            // If user had "参加しない" selected in social, and changes lecture to valid venues, clear social
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
                    options={getSocialOptions(item.venue_lecture || '')} // This logic needs to support multi lecture
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
            const [res, venuesRes, ranksRes] = await Promise.all([
                fetch('/api/admin/settings'),
                fetch('/api/admin/venues'),
                fetch('/api/admin/ranks')
            ]);

            if (res.ok) {
                const data = await res.json();
                const settings = data;

                if (venuesRes.ok) {
                    const vData = await venuesRes.json();
                    setVenueList(vData);
                }

                if (ranksRes.ok) {
                    setRanks(await ranksRes.json());
                }

                // Load Master
                const loadedMaster = settings.product_name_master || { names: [], venues: [], socials: [] };
                const venueMaster = settings.venue_master || { lecture_venues: [], social_venues: [] };

                setMaster({
                    names: Array.isArray(loadedMaster.names) ? loadedMaster.names : [],
                    venues: Array.isArray(loadedMaster.venues) ? loadedMaster.venues : [],
                    socials: Array.isArray(loadedMaster.socials) ? loadedMaster.socials : [],
                    lecture_venues: Array.isArray(venueMaster.lecture_venues) ? venueMaster.lecture_venues : [],
                    social_venues: Array.isArray(venueMaster.social_venues) ? venueMaster.social_venues : []
                });

                // Load Payment Links
                let linksArr: PaymentLinkItem[] = [];
                const val = settings.payment_links;

                if (Array.isArray(val)) {
                    linksArr = val.map((item: any) => ({
                        name: item.name || '',
                        lecture_fee: String(item.lecture_fee || 0),
                        social_fee: String(item.social_fee || 0),
                        key: item.key || '', // will be synced with name
                        url: item.url || '',
                        venue_lecture: item.venue_lecture || '',
                        venue_social: item.venue_social || '',
                        rank_id: item.rank_id || '',
                        product_code: item.product_code || ''
                    }));
                } else if (val) {
                    // Old Format Support
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

    const handleAddItem = () => {
        const name = newItem.name?.trim();
        if (!name) return;

        // Check duplicates
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

        setPaymentLinks([...paymentLinks, addedItem]);
        setNewItem({ name: '', url: '', lecture_fee: '0', social_fee: '0', venue_lecture: '', venue_social: '', rank_id: '', product_code: '' });
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

            // Auto-gen URL when code changes
            if (updates.product_code !== undefined) {
                updatedItem.url = generateUrl(updates.product_code);
            }

            newData[index] = updatedItem;
            return newData;
        });
    };

    const handleSave = async () => {
        if (!confirm('変更を保存しますか？')) return;
        try {
            // 1. Prepare Payment Links
            const saveLinks = paymentLinks.map(item => ({
                name: item.name,
                key: item.name, // Ensure key matches name
                url: item.url,
                lecture_fee: Number(item.lecture_fee),
                social_fee: Number(item.social_fee),
                venue_lecture: item.venue_lecture,
                venue_social: item.venue_social,
                rank_id: item.rank_id,
                product_code: item.product_code
            }));

            // 2. Prepare Product Master Names (Sync with keys and ORDER)
            const saveMaster = {
                ...master,
                names: saveLinks.map(l => l.name) // Order is preserved here!
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
                alert('保存しました');
                fetchSettings(); // Reload to confirm
            } else {
                alert('保存に失敗しました');
            }
        } catch (e) {
            console.error(e);
            alert('エラーが発生しました');
        }
    };

    const getSocialOptions = (lectureVenueName: string) => {
        if (!lectureVenueName || lectureVenueName === '参加しない') return [];
        const socialVenues = venueList.filter(v => v.type === 'social');
        //const notParticipating = "参加しない"; // Handled in Component now

        // If no lecture selected, maybe return all? or none? none.

        let targetNames: string[] = [];
        if (lectureVenueName.includes('・')) {
            targetNames = lectureVenueName.split('・');
        } else {
            targetNames = [lectureVenueName];
        }

        // Logic: Return social venues that match ANY of the selected lecture venues?
        // Or strictly match?
        // Usually, if I select "Tokyo", I want "Tokyo Social".
        // If I select "Tokyo" and "Osaka", I want "Tokyo Social" and "Osaka Social".
        // Assuming social venue names align with lecture names roughly?
        // Current logic was: check if social venue name matches or is part of split string.
        // Let's broaden: Return ALL social venues? The user can filter.
        // Creating a strict filter might be annoying if names mismatch.
        // But the previous requests asked for "Exclusive control".
        // "三か市内を選ぶと登録された会場は選択できない" -> "参加しない" Logic handles this.
        // "Choose Tokyo -> Cannot choose Fukuoka Social"? 
        // Let's filter by name inclusion.

        // Filter social venues that have same name as one of the lecture targets
        // Or contained in it.
        // This relies on naming convention. "Tokyo" lecture -> "Tokyo" social.

        return socialVenues.filter(sv => {
            // If social venue name is exactly in target list
            // Or if social venue name contains one of the targets? (e.g. "Tokyo Social" contains "Tokyo")
            return targetNames.some(tn => sv.name.includes(tn) || tn.includes(sv.name));
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPaymentLinks((items) => {
                const oldIndex = items.findIndex((item) => item.name === active.id); // Using name as ID
                const newIndex = items.findIndex((item) => item.name === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleExport = () => {
        const headers = [
            '商品名', '商品コード', 'URL', '属性ID',
            '講義会場', '懇親会会場', '受講料', '懇親会費'
            // Exclude redundant generated keys/urls from import perspective, but useful for export
        ];
        // Note: Exporting internal Rank ID might be hard for user to edit? 
        // Maybe export Rank Name? It's better, but for Import we need to map back.
        // Let's export Rank Name as well for reference? 
        // Or just keep it simple: Export ID. 
        // The user request is "Export/Import". 
        // Let's Export raw values.

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
        // Mapping
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

        // Merge logic: Update if name exists, Append if not
        // We do this locally.
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
                                    setNewItem({
                                        ...newItem,
                                        venue_lecture: val,
                                        venue_social: val === '参加しない' ? '参加しない' : (val ? newItem.venue_social : '')
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
                                        items={paymentLinks.map(p => p.key)} // Using Key/Name as ID
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {loading ? (
                                            <tr><td colSpan={10} className="p-4 text-center">Loading...</td></tr>
                                        ) : paymentLinks.length === 0 ? (
                                            <tr><td colSpan={10} className="p-4 text-center text-gray-400">登録データはありません</td></tr>
                                        ) : (
                                            paymentLinks.map((item, idx) => (
                                                <SortableRow
                                                    key={item.key} // Unique Key
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
