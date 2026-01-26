'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdminUser {
    id: string;
    username: string;
    email?: string;
    created_at: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({ username: '', password: '', email: '' });
    const [message, setMessage] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        if (!newItem.username || !newItem.password || !newItem.email) {
            setMessage('すべての項目を入力してください');
            return;
        }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem),
            });
            if (res.ok) {
                setMessage('追加しました');
                setNewItem({ username: '', password: '', email: '' });
                fetchUsers();
            } else {
                const data = await res.json();
                setMessage(`エラー: ${data.error}`);
            }
        } catch (e) {
            setMessage('エラーが発生しました');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
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
                <div className="mb-6 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">管理者ユーザー管理</h1>
                    <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800">
                        &larr; ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h2 className="text-lg font-bold mb-4">新規ユーザー追加</h2>
                    {message && <div className="mb-4 text-sm font-bold text-red-500">{message}</div>}
                    <form onSubmit={handleAdd} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">ユーザーID</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                value={newItem.username}
                                onChange={e => setNewItem({ ...newItem, username: e.target.value })}
                                placeholder="半角英数推奨"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">メールアドレス<span className="text-red-500">*</span></label>
                            <input
                                type="email"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                value={newItem.email}
                                onChange={e => setNewItem({ ...newItem, email: e.target.value })}
                                placeholder="パスワードリセット用"
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">パスワード</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                value={newItem.password}
                                onChange={e => setNewItem({ ...newItem, password: e.target.value })}
                                placeholder="予測困難なパスワード"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow"
                        >
                            追加
                        </button>
                    </form>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザーID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メールアドレス</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作成日時</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleString('ja-JP')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded border border-red-200"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">ユーザーがいません</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
