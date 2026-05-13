'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!token) {
        return (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-8 rounded-3xl text-center backdrop-blur-xl">
                <div className="flex justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <p className="font-bold mb-4 text-lg">無効なリンクです</p>
                <p className="text-sm text-red-200/70 mb-6">リンクの有効期限が切れているか、URLが正しくありません。</p>
                <Link 
                    href="/admin/login" 
                    className="inline-flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 px-6 py-3 rounded-2xl hover:bg-indigo-500 transition-colors"
                >
                    ログイン画面へ
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');

        // 文字コード正規化 (NFKC) を適用
        const normalizedPassword = password.trim().normalize('NFKC');
        const normalizedConfirm = confirm.trim().normalize('NFKC');

        if (normalizedPassword !== normalizedConfirm) {
            setError('パスワードが一致しません');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: normalizedPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage(data.message || 'パスワードを更新しました。');
                setTimeout(() => {
                    router.push('/admin/login');
                }, 2500);
            } else {
                setError(data.error || '更新に失敗しました。');
            }
        } catch (e) {
            setError('システムエラーが発生しました。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            {message && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-100 px-6 py-8 rounded-3xl text-center backdrop-blur-xl animate-in zoom-in duration-500">
                    <div className="flex justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Success!</h3>
                    <p className="text-emerald-100/70 mb-2">{message}</p>
                    <p className="text-xs text-emerald-100/40 italic">ログイン画面に自動的に移動します...</p>
                </div>
            )}
            
            {error && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-4 rounded-2xl text-sm flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {!message && (
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider ml-1">
                                New Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                                    placeholder="新しいパスワード"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider ml-1">
                                Confirm Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M2.166 4.9L9.03 9.103c.592.361 1.348.361 1.94 0L17.834 4.9A2.005 2.005 0 0016 4H4a2.005 2.005 0 00-1.834.9z" />
                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                                    placeholder="確認用パスワード"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-4 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                更新中...
                            </div>
                        ) : (
                            <span className="flex items-center gap-2">
                                パスワードを変更
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </span>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 font-sans">
            {/* Background Image with Overlay */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 transition-opacity duration-1000"
                style={{ backgroundImage: 'url("/images/login-bg.png")' }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-bl from-slate-950/90 via-slate-950/40 to-indigo-950/80" />

            {/* Decorative Elements */}
            <div className="absolute top-1/4 -left-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 -right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-[100px]" />

            <div className="relative z-10 max-w-md w-full px-6 py-12">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <div className="p-8 sm:p-12">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                                New Password
                            </h2>
                            <p className="text-indigo-200/60 text-sm">
                                セキュリティのため、新しい強力なパスワードを<br />
                                設定してください。
                            </p>
                        </div>
                        <Suspense fallback={<div className="text-white text-center py-10 animate-pulse">Loading...</div>}>
                            <ResetPasswordForm />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
