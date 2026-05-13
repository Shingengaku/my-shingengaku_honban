'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);

        try {
            // メールアドレスも正規化 (NFKC) を適用
            const normalizedEmail = email.trim().toLowerCase().normalize('NFKC');

            const res = await fetch('/api/admin/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage(data.message || 'メールを送信しました。');
            } else {
                setError(data.error || '送信に失敗しました。');
            }
        } catch (e) {
            setError('システムエラーが発生しました。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
            {/* Background Image with Overlay */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 transition-opacity duration-1000"
                style={{ backgroundImage: 'url("/images/login-bg.png")' }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-tr from-slate-950/90 via-slate-950/50 to-indigo-950/70" />

            {/* Decorative Elements */}
            <div className="absolute top-1/3 -right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/3 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />

            <div className="relative z-10 max-w-md w-full px-6">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="p-8 sm:p-10">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                                Reset Password
                            </h2>
                            <p className="text-indigo-200/70 text-sm leading-relaxed">
                                登録されたメールアドレスを入力してください。<br />
                                パスワード再設定用のリンクをお送りします。
                            </p>
                        </div>

                        {message && (
                            <div className="mb-6 animate-in fade-in zoom-in duration-300">
                                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 px-4 py-4 rounded-2xl text-sm flex items-start gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>{message}</span>
                                </div>
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
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wider ml-1">
                                        Email Address
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                        />
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
                                            送信中...
                                        </div>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            リセットリンクを送信
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="mt-8 text-center">
                            <Link 
                                href="/admin/login" 
                                className="text-sm font-medium text-indigo-300 hover:text-white transition-colors inline-flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                                ログイン画面に戻る
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
