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

interface Term {
    id: number;
    name: string;
    sort_order: number;
}

function SortableItem({ term, onDelete }: { term: Term, onDelete: (id: number) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: term.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center bg-white p-3 mb-2 rounded shadow-sm border group">
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 mr-3 hover:text-gray-600 px-2" title="ドラッグして移動">
                ⋮⋮
            </div>
            <div className="flex-1 font-medium text-gray-800">
                {term.name}
            </div>
            <button
                onClick={() => onDelete(term.id)}
                className="text-red-400 hover:text-red-600 px-3 py-1 text-sm rounded hover:bg-red-50 transition-colors"
                type="button"
            >
                削除
            </button>
        </div>
    );
}

export default function TermMasterPage() {
    const [terms, setTerms] = useState<Term[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTermName, setNewTermName] = useState('');
    const [saving, setSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchTerms = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/terms');
            if (res.ok) {
                const data = await res.json();
                setTerms(data);
            }
        } catch (e) {
            console.error(e);
            alert('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTerms();
    }, []);

    const handleAdd = async () => {
        if (!newTermName.trim()) return;

        try {
            const res = await fetch('/api/admin/terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTermName })
            });

            if (res.ok) {
                const addedTerm = await res.json();
                setTerms([...terms, addedTerm]);
                setNewTermName('');
            } else {
                alert('追加に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？\nすでにこの期を使用している会員がいる場合、表示等の不整合が起きる可能性があります。')) return;

        try {
            const res = await fetch(`/api/admin/terms?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setTerms(terms.filter(t => t.id !== id));
            } else {
                alert('削除に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTerms((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            const itemsToSave = terms.map((term, index) => ({
                id: term.id,
                sort_order: (index + 1) * 10
            }));

            const res = await fetch('/api/admin/terms/reorder', {
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

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">期マスタ管理</h1>
                    <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600">
                        ← ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="mb-6 bg-blue-50 p-4 rounded text-sm text-blue-800 border-l-4 border-blue-500">
                        <p className="font-bold mb-1">使い方</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>新しい期を追加するには、下部の入力欄に入力して「追加」ボタンを押してください。</li>
                            <li>「15期」のような数字だけでなく、「経営幹部コース」などの文字も入力可能です。</li>
                            <li><strong>リストの「⋮⋮」をドラッグ＆ドロップ</strong>することで順序を変更できます。</li>
                            <li>順序を変更した後は、必ず<strong>「並び順を保存する」</strong>ボタンを押してください。</li>
                        </ul>
                    </div>

                    <div className="flex gap-2 mb-8 bg-gray-50 p-4 rounded border">
                        <input
                            type="text"
                            className="flex-1 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="新しい期を入力 (例: 15期, 特別コース)"
                            value={newTermName}
                            onChange={e => setNewTermName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleAdd();
                            }}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newTermName.trim()}
                            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            追加
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">読み込み中...</div>
                    ) : (
                        <div className="mb-6">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={terms.map(t => t.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {terms.length === 0 ? (
                                            <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded">
                                                登録された期はありません
                                            </div>
                                        ) : terms.map((term) => (
                                            <SortableItem key={term.id} term={term} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    )}

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
