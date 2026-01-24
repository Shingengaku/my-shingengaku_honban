'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GlobalSettingsPage() {
    const [settings, setSettings] = useState({
        application_text: '',
        application_active: true,
        application_title: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if (res.ok) {
                    const data = await res.json();

                    // The API returns values as formatted JSON object or raw Key-Value from table
                    // Based on previous checks, /api/admin/settings returns { ...key: value } 
                    // Let's verify inspect of /api/admin/settings if possible, but assuming standard format we saw in client
                    // Actually, let's assume the API might return the raw key-value pairs or the reshaped object.
                    // The public /api/settings returns reshaped object. 
                    // Let's assume /api/admin/settings is similar or we handle it.
                    // Looking at `products/page.tsx`, it calls `/api/admin/settings` and expects `data.payment_links` etc.
                    // So it returns a reshaped object.

                    setSettings({
                        application_text: data.application_text || '',
                        application_active: data.application_active !== false, // Default to true
                        application_title: data.application_title || ''
                    });
                }
            } catch (e) {
                console.error(e);
                alert('設定の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                alert('設定を保存しました');
            } else {
                alert('保存に失敗しました');
            }
        } catch (e) {
            console.error(e);
            alert('エラーが発生しました');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">全体設定 (フォーム文言・受付)</h1>
                    <Link href="/admin/dashboard" className="text-gray-600 hover:text-indigo-600">
                        ← ダッシュボードに戻る
                    </Link>
                </div>

                <div className="bg-white rounded-lg shadow p-6 space-y-6">

                    {/* 受付ステータス */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">受付ステータス</h2>
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={settings.application_active}
                                    onChange={() => setSettings({ ...settings, application_active: true })}
                                    className="h-4 w-4 text-indigo-600"
                                />
                                <span className="text-gray-900">受付中</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!settings.application_active}
                                    onChange={() => setSettings({ ...settings, application_active: false })}
                                    className="h-4 w-4 text-red-600"
                                />
                                <span className="text-red-600 font-bold">受付停止</span>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">※「受付停止」にすると、申込フォームへのアクセス時に停止メッセージが表示され、申し込みができなくなります。</p>
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* フォームタイトル */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">申込フォームタイトル</h2>
                        <input
                            type="text"
                            className="w-full p-3 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="例：神言学 集中講座 お申込み"
                            value={settings.application_title || ''}
                            onChange={(e) => setSettings({ ...settings, application_title: e.target.value })}
                        />
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* フォーム上部テキスト */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">申込フォーム上部テキスト</h2>
                        <p className="text-sm text-gray-600 mb-2">
                            申込フォームのタイトル直下に表示されるお知らせメッセージです。<br />
                            空欄の場合は表示されません。改行は反映されます。
                        </p>
                        <textarea
                            className="w-full h-40 p-3 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="例：\n第5期の受付を開始しました。\n定員に達し次第終了となります。"
                            value={settings.application_text}
                            onChange={(e) => setSettings({ ...settings, application_text: e.target.value })}
                        />
                    </div>

                    <div className="border-t pt-6 flex gap-4">
                        <Link href="/admin/dashboard" className="w-1/3 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-center text-gray-700 bg-white hover:bg-gray-50 font-bold block">
                            閉じる
                        </Link>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-2/3 py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 font-bold ${saving ? 'opacity-50' : ''}`}
                        >
                            {saving ? '保存中...' : '設定を保存する'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
