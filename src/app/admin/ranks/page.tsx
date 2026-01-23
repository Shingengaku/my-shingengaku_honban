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

interface Rank {
    id: number;
    name: string;
    base_fee: number;
    sort_order: number;
}

function SortableRow({ rank, onEdit, onDelete }: { rank: Rank, onEdit: (rank: Rank) => void, onDelete: (id: number) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: rank.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <tr ref={setNodeRef} style={style} className="bg-white hover:bg-gray-50 group">
            <td className="px-6 py-4 whitespace-nowrap text-center cursor-grab" {...attributes} {...listeners}>
                <span className="text-gray-400 group-hover:text-gray-600 font-bold text-lg">⋮⋮</span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{rank.name}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                    onClick={() => onEdit(rank)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4 bg-indigo-50 px-3 py-1 rounded"
                >
                    編集
                </button>
                <button
                    onClick={() => onDelete(rank.id)}
                    className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1 rounded"
                >
                    削除
                </button>
            </td>
        </tr>
    );
}

export default function RanksPage() {
    const [ranks, setRanks] = useState<Rank[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingRank, setEditingRank] = useState<Rank | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        base_fee: '0'
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchRanks();
    }, []);

    const fetchRanks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/ranks');
            if (res.ok) {
                const data = await res.json();
                setRanks(data);
            }
        } catch (e) {
            console.error(e);
            alert('データ取得エラー');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (rank?: Rank) => {
        if (rank) {
            setEditingRank(rank);
            setFormData({
                name: rank.name,
                base_fee: String(rank.base_fee)
            });
        } else {
            setEditingRank(null);
            setFormData({
                name: '',
                base_fee: '0'
            });
        }
        setShowModal(true);
    };

    const handleSaveItem = async () => {
        // ロジックを追加または更新（ここではsort_order操作なし、保存のみ）
        // 新規の場合、sort_orderは最大値+10である必要があります（APIまたはトリガーで処理？APIは現在CRUDの基本のみを処理します）
        // POST APIは 'sort_order' を期待しています。ここで計算するか、APIが処理する必要があります。
        // ここでは安全な値または既存の値を渡しましょう。

        let sortOrder = editingRank?.sort_order;
        if (sortOrder === undefined) {
            // 新規アイテム、末尾に追加
            const max = ranks.length > 0 ? Math.max(...ranks.map(r => r.sort_order)) : 0;
            sortOrder = max + 10;
        }

        const payload = {
            id: editingRank?.id,
            name: formData.name,
            base_fee: Number(formData.base_fee),
            sort_order: sortOrder
        };

        const method = editingRank ? 'PUT' : 'POST';

        try {
            const res = await fetch('/api/admin/ranks', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowModal(false);
                fetchRanks();
            } else {
                const err = await res.json();
                alert(`保存失敗: ${err.error}`);
            }
        } catch (e) {
            alert('保存エラー');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？\nシステム整合性に影響が出る可能性があります。')) return;

        try {
            const res = await fetch(`/api/admin/ranks?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setRanks(ranks.filter(r => r.id !== id));
            } else {
                alert('削除失敗');
            }
        } catch (e) {
            alert('エラー');
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setRanks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            const itemsToSave = ranks.map((rank, index) => ({
                id: rank.id,
                sort_order: (index + 1) * 10
            }));

            const res = await fetch('/api/admin/ranks/reorder', {
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
            alert('エラー');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const headers = ['ID', '属性名', '会費', '並び順'];
        const rows = ranks.map(r => [r.id, r.name, r.base_fee, r.sort_order]);
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ranks_master_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];
        e.target.value = '';

        if (!confirm('CSVファイルをインポートしますか？\n既存の「属性名」と一致するデータは更新され、新規のみ追加されます。')) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        // Note: Use created API
        try {
            const res = await fetch('/api/admin/ranks/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`${data.count}件処理しました`);
                fetchRanks();
            } else {
                alert(`インポート失敗: ${data.error}`);
            }
        } catch (e) {
            alert('通信エラー');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">属性マスタ管理</h1>
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

                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <div className="mb-4 bg-blue-50 p-4 rounded text-sm text-blue-800">
                        <p><strong>使い方:</strong></p>
                        <ul className="list-disc pl-5">
                            <li>「新規属性登録」ボタンで新しい属性を追加できます。</li>
                            <li><strong>リスト左端の「⋮⋮」をドラッグ</strong>して並び順を変更できます。</li>
                            <li>並び替えた後は必ず<strong>「並び順を保存する」</strong>ボタンを押してください。</li>
                        </ul>
                    </div>

                    <div className="flex justify-between mb-4">
                        <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold">
                            + 新規属性登録
                        </button>
                        <button
                            onClick={handleSaveOrder}
                            disabled={saving || loading}
                            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold shadow disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '並び順を保存する'}
                        </button>
                    </div>

                    <div className="border rounded overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">移動</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">属性名</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <tbody className="bg-white divide-y divide-gray-200">
                                    <SortableContext
                                        items={ranks.map(r => r.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {loading ? (
                                            <tr><td colSpan={3} className="p-4 text-center">Loading...</td></tr>
                                        ) : ranks.length === 0 ? (
                                            <tr><td colSpan={3} className="p-4 text-center text-gray-400">データがありません</td></tr>
                                        ) : (
                                            ranks.map((rank) => (
                                                <SortableRow key={rank.id} rank={rank} onEdit={handleOpenModal} onDelete={handleDelete} />
                                            ))
                                        )}
                                    </SortableContext>
                                </tbody>
                            </DndContext>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 px-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">{editingRank ? '属性編集' : '新規属性登録'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">属性名</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="例: 一般"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">キャンセル</button>
                            <button onClick={handleSaveItem} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
