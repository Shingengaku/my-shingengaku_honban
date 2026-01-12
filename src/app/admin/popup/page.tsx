'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PopupSettingsPage() {
    const router = useRouter();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if (res.ok) {
                    const data = await res.json();
                    setText(data.application_text || '');
                }
            } catch (e) {
                console.error('Failed to load settings');
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ application_text: text }),
            });
            if (res.ok) {
                setMessage('保存しました');
            } else {
                setMessage('保存に失敗しました');
            }
        } catch (e) {
            setMessage('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        申込画面お知らせ設定
                    </h1>
                    <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-900">
                        ダッシュボードに戻る
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            お知らせテキスト
                        </label>
                        <p className="text-sm text-gray-500 mb-2">
                            申込画面（トップページ）を開いた時にポップアップで表示する文章を設定します。<br />
                            空欄にして保存すると、ポップアップは表示されません。
                        </p>
                        <textarea
                            className="w-full border rounded p-2 h-64 font-sans"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="例：現在、申し込みが殺到しており..."
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? '保存中...' : '保存する'}
                        </button>
                        {message && (
                            <span className={`text-sm ${message.includes('失敗') || message.includes('エラー') ? 'text-red-600' : 'text-green-600'}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
