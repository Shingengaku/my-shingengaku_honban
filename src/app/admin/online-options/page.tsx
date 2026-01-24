'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface OnlineOption {
    id: number;
    name: string;
    type: 'live' | 'archive';
    sort_order: number;
}

export default function OnlineOptionsPage() {
    const [options, setOptions] = useState<OnlineOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState<{ name: string, type: 'live' | 'archive' }>({
        name: '',
        type: 'live'
    });

    const fetchOptions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/online-options');
            if (res.ok) {
                const data = await res.json();
                setOptions(data);
            }
        } catch (e) {
            console.error(e);
            alert('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOptions();
    }, []);

    const handleAdd = async () => {
        if (!newItem.name) return;
        try {
            const res = await fetch('/api/admin/online-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newItem.name,
                    type: newItem.type,
                    sort_order: options.length + 10 // Simple sort order increment
                })
            });

            if (res.ok) {
                setNewItem({ name: '', type: 'live' });
                fetchOptions();
            } else {
                const data = await res.json();
                alert('追加に失敗しました: ' + (data.error || '不明なエラー'));
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        try {
            const res = await fetch(`/api/admin/online-options?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchOptions();
            } else {
                alert('削除に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">オンライン視聴マスタ管理</h1>
                    <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600">
                        ← ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded"
                                placeholder="例：LIVE視聴"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={newItem.type}
                                onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'live' | 'archive' })}
                            >
                                <option value="live">LIVE (生配信)</option>
                                <option value="archive">アーカイブ (録画)</option>
                            </select>
                        </div>
                        <button
                            onClick={handleAdd}
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 font-bold"
                        >
                            追加
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">表示名</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={3} className="p-4 text-center">読み込み中...</td></tr>
                            ) : options.length === 0 ? (
                                <tr><td colSpan={3} className="p-4 text-center text-gray-500">データがありません</td></tr>
                            ) : (
                                options.map((opt) => (
                                    <tr key={opt.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{opt.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {opt.type === 'live' ?
                                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">LIVE</span> :
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">アーカイブ</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(opt.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                削除
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
