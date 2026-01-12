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
function SortableRow({
    id,
    item,
    index,
    ranks,
    venueList,
    getSocialOptions,
    updateRow,
    handleDelete
}: {
    id: string,
    item: PaymentLinkItem,
    index: number,
    ranks: Rank[],
    venueList: Venue[],
    getSocialOptions: (v: string) => Venue[],
    updateRow: (idx: number, field: string, val: string) => void,
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
                <input className="w-full border rounded px-2 py-1" value={item.name} onChange={(e) => updateRow(index, 'name', e.target.value)} />
            </td>
            <td className="p-2 align-top">
                <input
                    className="w-full border rounded px-2 py-1 bg-white text-gray-600 font-mono"
                    value={item.product_code || ''}
                    onChange={(e) => updateRow(index, 'product_code', e.target.value)}
                    placeholder="Code"
                />
            </td>
            <td className="p-2 align-top">
                <input
                    className="w-full border rounded px-2 py-1 text-[10px] text-gray-500 font-mono"
                    value={item.url}
                    onChange={(e) => updateRow(index, 'url', e.target.value)}
                    placeholder="URL"
                />
            </td>
            <td className="p-2 align-top">
                <select className="w-full border rounded px-1 py-1 text-xs" value={item.rank_id || ''} onChange={(e) => updateRow(index, 'rank_id', e.target.value)}>
                    <option value="">-</option>
                    {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </td>
            <td className="p-2 align-top">
                <select className="w-full border rounded px-1 py-1 text-xs" value={item.venue_lecture || ''} onChange={(e) => { updateRow(index, 'venue_lecture', e.target.value); updateRow(index, 'venue_social', ''); }}>
                    <option value="">-</option>
                    {venueList.filter(v => v.type === 'lecture').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    <option value="参加しない">不参加</option>
                </select>
            </td>
            <td className="p-2 align-top">
                <select className="w-full border rounded px-1 py-1 text-xs" value={item.venue_social || ''} onChange={(e) => updateRow(index, 'venue_social', e.target.value)} disabled={!item.venue_lecture}>
                    <option value="">-</option>
                    {getSocialOptions(item.venue_lecture || '').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    <option value="参加しない">不参加</option>
                </select>
            </td>
            <td className="p-2 align-top">
                <input type="number" className="w-full border rounded px-1 py-1 text-right text-xs" value={item.lecture_fee} onChange={(e) => updateRow(index, 'lecture_fee', e.target.value)} />
            </td>
            <td className="p-2 align-top">
                <input type="number" className="w-full border rounded px-1 py-1 text-right text-xs" value={item.social_fee} onChange={(e) => updateRow(index, 'social_fee', e.target.value)} />
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

    const updateRow = (index: number, field: string, val: string) => {
        const newData = [...paymentLinks];
        // @ts-ignore
        newData[index][field] = val;

        if (field === 'name') {
            newData[index].key = val;
        }

        // Auto-gen URL when code changes
        if (field === 'product_code') {
            newData[index].url = generateUrl(val);
        }

        setPaymentLinks(newData);
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
        if (!lectureVenueName) return [];
        const socialVenues = venueList.filter(v => v.type === 'social');
        const notParticipating = "参加しない";

        // Helper to convert Venue[] to simpler array if needed, but we return Venue[]
        let filtered: Venue[] = [];

        if (lectureVenueName.includes('・')) {
            const parts = lectureVenueName.split('・');
            filtered = socialVenues.filter(v =>
                v.name === lectureVenueName ||
                parts.includes(v.name) ||
                v.name === notParticipating
            );
        } else {
            filtered = socialVenues.filter(v =>
                v.name === lectureVenueName ||
                v.name === notParticipating
            );
        }
        return filtered;
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

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">商品マスタ管理 (決済リンク設定)</h1>
                    <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600">
                        ← ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-6 bg-blue-50 p-4 rounded text-sm text-blue-800">
                        <ul className="list-disc pl-5">
                            <li>商品名、コード、金額等を設定します。</li>
                            <li><strong>リスト左端の「⋮⋮」をドラッグ</strong>して並び順を変更できます。</li>
                            <li>並び順は、ダッシュボードの編集画面などのプルダウン順序に反映されます。</li>
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
                            <select
                                className="w-full border p-2 rounded"
                                value={newItem.venue_lecture || ''}
                                onChange={e => setNewItem({ ...newItem, venue_lecture: e.target.value, venue_social: '' })}
                            >
                                <option value="">(選択なし)</option>
                                {venueList.filter(v => v.type === 'lecture').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                <option value="参加しない">参加しない</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">懇親会会場</label>
                            <select
                                className="w-full border p-2 rounded bg-white disabled:bg-gray-100"
                                value={newItem.venue_social || ''}
                                onChange={e => setNewItem({ ...newItem, venue_social: e.target.value })}
                                disabled={!newItem.venue_lecture}
                            >
                                <option value="">(選択なし)</option>
                                {getSocialOptions(newItem.venue_lecture || '').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                <option value="参加しない">参加しない</option>
                            </select>
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

                    <div className="border rounded overflow-hidden">
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
                                                    updateRow={updateRow}
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
