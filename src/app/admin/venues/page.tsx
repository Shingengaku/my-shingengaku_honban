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

interface Venue {
    id: number;
    name: string;
    type: 'lecture' | 'social';
    sort_order: number;
    is_recruitment_ended?: boolean;
}

function SortableItem({ venue, onDelete, onToggle }: { venue: Venue, onDelete: (id: number) => void, onToggle: (id: number, currentStatus: boolean) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: venue.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li ref={setNodeRef} style={style} className={`p-3 flex justify-between items-center bg-white border-b last:border-b-0 hover:bg-gray-50 group ${venue.is_recruitment_ended ? 'opacity-75 bg-gray-50' : ''}`}>
            <div className="flex items-center gap-3 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab text-gray-400 group-hover:text-gray-600 font-bold px-1" title="ドラッグして移動">
                    ⋮⋮
                </div>
                <span className={`font-medium ${venue.is_recruitment_ended ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{venue.name}</span>
            </div>
            <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer text-sm">
                    <span className={`mr-2 font-bold ${venue.is_recruitment_ended ? 'text-red-600' : 'text-gray-400'}`}>募集終了</span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!venue.is_recruitment_ended}
                            onChange={() => onToggle(venue.id, !!venue.is_recruitment_ended)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${venue.is_recruitment_ended ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${venue.is_recruitment_ended ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                </label>
                <button
                    onClick={() => onDelete(venue.id)}
                    className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs transition-colors shrink-0"
                    type="button"
                >
                    削除
                </button>
            </div>
        </li>
    );
}

export default function VenueMasterPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newLectureVenue, setNewLectureVenue] = useState('');
    const [newSocialVenue, setNewSocialVenue] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchVenues();
    }, []);

    const fetchVenues = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/venues');
            if (res.ok) {
                // APIはsort_orderでソートします
                setVenues(await res.json());
            }
        } catch (e) {
            console.error(e);
            alert('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const addVenue = async (name: string, type: 'lecture' | 'social') => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        if (trimmedName === '参加しない' || trimmedName === '参加しません') {
            alert('「参加しない」という会場はシステムにより自動管理されているため、手動で追加することはできません。');
            return;
        }

        // sort_orderを計算: 最大値 + 10
        const typeVenues = venues.filter(v => v.type === type);
        const maxSort = typeVenues.length > 0 ? Math.max(...typeVenues.map(v => v.sort_order)) : 0;
        const nextSort = maxSort + 10;

        try {
            const res = await fetch('/api/admin/venues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), type, sort_order: nextSort })
            });

            if (res.ok) {
                if (type === 'lecture') {
                    setNewLectureVenue('');
                } else {
                    setNewSocialVenue('');
                }
                fetchVenues();
            } else {
                alert('追加に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const removeVenue = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        try {
            const res = await fetch(`/api/admin/venues?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setVenues(venues.filter(v => v.id !== id));
            } else {
                alert('削除に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const toggleRecruitmentStatus = async (id: number, currentStatus: boolean) => {
        try {
            const res = await fetch('/api/admin/venues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_recruitment_ended: !currentStatus })
            });
            if (res.ok) {
                setVenues(venues.map(v => v.id === id ? { ...v, is_recruitment_ended: !currentStatus } : v));
            } else {
                alert('更新に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleDragEndLecture = (event: DragEndEvent) => {
        handleDragEnd(event, 'lecture');
    };

    const handleDragEndSocial = (event: DragEndEvent) => {
        handleDragEnd(event, 'social');
    };

    const handleDragEnd = (event: DragEndEvent, type: 'lecture' | 'social') => {
        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;

        // このタイプのアイテムを抽出
        // 注: サブセット内の相対的な移動に基づいて、完全な会場リストを操作する必要があります
        // しかしDndKitはIDで動作します。

        setVenues((items) => {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);
            return arrayMove(items, oldIndex, newIndex);
        });
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            // 現在の配列順序に基づいて、すべての会場のsort_orderを再計算します
            const itemsToSave = venues.map((v, index) => ({
                id: v.id,
                sort_order: (index + 1) * 10
            }));

            const res = await fetch('/api/admin/venues/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToSave })
            });

            if (res.ok) {
                alert('並び順を保存しました');
            } else {
                alert('保存に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const headers = ['ID', '会場名', 'タイプ(lecture/social)', '並び順'];
        const rows = venues.map(v => [v.id, v.name, v.type, v.sort_order]);
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `venues_master_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];
        e.target.value = '';

        if (!confirm('CSVファイルをインポートしますか？\n既存の「会場名」と一致するデータは更新され、新規のみ追加されます。')) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        // 注: 作成されたAPIを使用
        try {
            const res = await fetch('/api/admin/venues/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`${data.count}件処理しました`);
                fetchVenues();
            } else {
                alert(`インポート失敗: ${data.error}`);
            }
        } catch (e) {
            alert('通信エラー');
        } finally {
            setLoading(false);
        }
    };

    const lectureVenues = venues.filter(v => v.type === 'lecture');
    const socialVenues = venues.filter(v => v.type === 'social');

    // DndContextにはIDが必要です。
    // 2つのリストがあります。`DndContext`を別々に使用するか、ID名前空間を慎重に管理する必要がありますか？
    // IDはDB内で一意なので問題ありません。

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">会場マスタ管理</h1>
                    <div className="flex gap-4 items-center">
                        <button onClick={handleExport} className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm">CSVエクスポート</button>
                        <label className="cursor-pointer px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center">
                            CSVインポート
                            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                        </label>
                        <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600 flex items-center">
                            ← ダッシュボードに戻る
                        </Link>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <div className="mb-6 bg-yellow-50 p-4 rounded text-sm text-yellow-800">
                        <p><strong>使い方:</strong></p>
                        <ul className="list-disc pl-5">
                            <li>新しい会場を追加するには、入力欄に入力して「追加」を押してください。</li>
                            <li><strong>リストの「⋮⋮」をドラッグ</strong>して並び順を変更できます。</li>
                            <li>並び替えた後は、右下の<strong>「並び順を保存する」</strong>ボタンを押してください。</li>
                        </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Lecture Venues */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">講義会場</span>
                                Lecture
                            </h2>
                            <div className="flex gap-2 mb-4">
                                <input
                                    className="border rounded p-2 flex-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="例: 東京"
                                    value={newLectureVenue}
                                    onChange={e => setNewLectureVenue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addVenue(newLectureVenue, 'lecture')}
                                />
                                <button onClick={() => addVenue(newLectureVenue, 'lecture')} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 font-bold whitespace-nowrap">追加</button>
                            </div>

                            <div className="bg-gray-50 rounded border overflow-hidden">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEndLecture}
                                >
                                    <div className="divide-y">
                                        <SortableContext items={lectureVenues.map(v => v.id)} strategy={verticalListSortingStrategy}>
                                            {lectureVenues.length === 0 ? (
                                                <div className="p-4 text-center text-gray-400 text-sm">登録なし</div>
                                            ) : lectureVenues.map((v) => (
                                                <SortableItem key={v.id} venue={v} onDelete={removeVenue} onToggle={toggleRecruitmentStatus} />
                                            ))}
                                        </SortableContext>
                                        <div className="p-3 flex justify-between items-center bg-gray-50 border-b group opacity-70">
                                            <div className="flex items-center gap-3">
                                                <div className="text-gray-300 font-bold px-1 select-none">
                                                    🔒
                                                </div>
                                                <span className="font-medium text-gray-500">参加しない <span className="text-xs text-gray-400">(システム固定)</span></span>
                                            </div>
                                        </div>
                                    </div>
                                </DndContext>
                            </div>
                        </div>

                        {/* Social Venues */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                <span className="bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded">懇親会会場</span>
                                Social
                            </h2>
                            <div className="flex gap-2 mb-4">
                                <input
                                    className="border rounded p-2 flex-1 focus:ring-2 focus:ring-pink-500 outline-none"
                                    placeholder="例: 東京・福岡"
                                    value={newSocialVenue}
                                    onChange={e => setNewSocialVenue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addVenue(newSocialVenue, 'social')}
                                />
                                <button onClick={() => addVenue(newSocialVenue, 'social')} className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 font-bold whitespace-nowrap">追加</button>
                            </div>

                            <div className="bg-gray-50 rounded border overflow-hidden">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEndSocial}
                                >
                                    <div className="divide-y">
                                        <SortableContext items={socialVenues.map(v => v.id)} strategy={verticalListSortingStrategy}>
                                            {socialVenues.length === 0 ? (
                                                <div className="p-4 text-center text-gray-400 text-sm">登録なし</div>
                                            ) : socialVenues.map((v) => (
                                                <SortableItem key={v.id} venue={v} onDelete={removeVenue} onToggle={toggleRecruitmentStatus} />
                                            ))}
                                        </SortableContext>
                                        <div className="p-3 flex justify-between items-center bg-gray-50 border-b group opacity-70">
                                            <div className="flex items-center gap-3">
                                                <div className="text-gray-300 font-bold px-1 select-none">
                                                    🔒
                                                </div>
                                                <span className="font-medium text-gray-500">参加しない <span className="text-xs text-gray-400">(システム固定)</span></span>
                                            </div>
                                        </div>
                                    </div>
                                </DndContext>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end border-t pt-6">
                        <button
                            onClick={handleSaveOrder}
                            disabled={saving || loading}
                            className="bg-green-600 text-white px-8 py-3 rounded hover:bg-green-700 font-bold shadow-lg disabled:opacity-50 transition-transform transform active:scale-95 flex items-center"
                        >
                            {saving ? '保存中...' : '並び順を保存する'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
