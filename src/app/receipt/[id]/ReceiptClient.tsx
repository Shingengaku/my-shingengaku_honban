'use client';

import { useState, useRef, useEffect } from 'react';

// Supabase等から取得したデータの型
export interface ReceiptData {
    id: string; // application_id
    input_name: string;
    venue: string;
    social_venue: string;
    lecture_fee: number;
    social_fee: number;
    total_amount_from_db?: number;
    is_amount_mismatched?: boolean;
    tags: string[];
    created_at: string;
    applied_rank_name: string;
    isAdmin: boolean;
}

export type SplitType = 'combined' | 'lecture' | 'social';

export default function ReceiptClient({ data }: { data: ReceiptData }) {
    // 状態管理
    const [docType, setDocType] = useState<'receipt' | 'invoice'>('receipt');
    const [splitType, setSplitType] = useState<SplitType>('combined');
    const [addressee, setAddressee] = useState(data.input_name);
    
    // 日付の初期値は今日
    const today = new Date().toISOString().split('T')[0];
    const [issueDate, setIssueDate] = useState(today);
    
    // 支払方法
    const [paymentMethod, setPaymentMethod] = useState('銀行振込');
    
    // UI状態
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // 発行済みタグ
    const isDocIssued = (checkDocType: 'receipt' | 'invoice', checkSplitType: SplitType) => {
        const prefix = checkDocType === 'receipt' ? 'receipted' : 'invoiced';
        
        // 1. 指定のタグがそのまま付いているか
        let exactTag = prefix;
        if (checkSplitType === 'lecture') exactTag += '_lecture';
        if (checkSplitType === 'social') exactTag += '_social';
        
        if (data.tags.includes(exactTag)) return true;

        // 2. 「合算」で発行しようとしているのに、すでに合算発行済みか（上記でカバー済みだが念の為）または「単独」で発行済みか
        if (checkSplitType === 'combined') {
            if (data.tags.includes(prefix + '_lecture') || data.tags.includes(prefix + '_social')) return true;
        }

        // 3. 「単独」で発行しようとしているのに、すでに「合算」で発行済みか
        if (checkSplitType !== 'combined') {
            if (data.tags.includes(prefix)) return true;
        }

        return false;
    };

    const isCurrentDocIssued = isDocIssued(docType, splitType);

    // 計算
    let totalAmount = 0;
    if (splitType === 'combined') totalAmount = data.lecture_fee + data.social_fee;
    else if (splitType === 'lecture') totalAmount = data.lecture_fee;
    else if (splitType === 'social') totalAmount = data.social_fee;

    const handleGenerate = async () => {
        // お客様側で既に発行済みの場合はブロック（管理者はスルー可能）
        if (!data.isAdmin) {
            if (isCurrentDocIssued) {
                setErrorMsg(`対象の${docType === 'receipt' ? '領収書' : '請求書'}（${splitType === 'combined' ? '合算' : (splitType === 'lecture' ? '受講費のみ' : '懇親会費のみ')}）は既に発行済み、または競合する種類の書類が発行済みです。再発行が必要な場合は管理者へお問い合わせください。`);
                return;
            }
        }

        setIsGenerating(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            // 発行記録（印）をつけるAPIを呼ぶ
            const apiTypeBase = docType === 'receipt' ? 'receipt_issued' : 'invoice_issued';
            const apiTypeModifier = splitType === 'combined' ? '' : (splitType === 'lecture' ? '_lecture' : '_social');
            
            const res = await fetch('/api/receipt/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: data.id,
                    type: apiTypeBase + apiTypeModifier,
                    is_admin: data.isAdmin
                })
            });

            const resData = await res.json();

            if (!res.ok) {
                if (resData.error === 'ALREADY_ISSUED') {
                    setErrorMsg(resData.message);
                } else {
                    setErrorMsg('発行記録のエラーが発生しました: ' + (resData.error || 'Unknown error'));
                }
                setIsGenerating(false);
                return;
            }

            // API成功後、印刷ダイアログを呼び出す
            setSuccessMsg('書類の準備ができました。印刷ダイアログが開きます。');
            
            // 状態が画面に反映されるのを少し待ってから印刷ダイアログを開く
            setTimeout(() => {
                window.print();
                setIsGenerating(false);
            }, 500);

        } catch (e: any) {
            setErrorMsg('通信エラーが発生しました: ' + e.message);
            setIsGenerating(false);
        }
    };

    // 金額フォーマット関数
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white text-gray-800 font-sans">
            
            {/* ！！！ コントロールパネル（印刷時には非表示になります） ！！！ */}
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 print:hidden">
                <div className="bg-white shadow rounded-lg p-6 mb-8 border border-gray-200">
                    <h1 className="text-2xl font-bold mb-6 text-indigo-700">
                        {data.isAdmin ? '【管理者用】書類発行ツール' : '書類発行（PDF保存）'}
                    </h1>

                    {data.isAdmin && (
                        <>
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                            <strong>管理者モード:</strong> 発行制限テストなどを無視して作成可能です。お客様画面と同じレイアウトを確認できます。
                        </div>
                        {data.is_amount_mismatched && (
                            <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded text-sm font-bold text-red-800">
                                ⚠️ 金額アンマッチ警告: 商品マスタおよび設定から自動算出した合計金額（{formatCurrency(data.lecture_fee + data.social_fee)}）と、決済時の登録額（{formatCurrency(data.total_amount_from_db || 0)}）が一致していません。<br />
                                イレギュラーな決済や割引が行われている可能性があります。内容を確認して、お客様にお渡しする前に管理画面等で正しい書類金額になっているか確認してください。
                            </div>
                        )}
                        </>
                    )}

                    {!data.isAdmin && isCurrentDocIssued && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            <strong>※ご注意:</strong><br/>
                            対象の{docType === 'receipt' ? '領収書' : '請求書'}は既に発行済みです。<br/>
                            再発行をご希望の場合は、主催者（管理者）までお問い合わせください。
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 左：書類種類と宛名 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行する書類</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input 
                                            type="radio" 
                                            name="docType" 
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            checked={docType === 'receipt'}
                                            onChange={() => setDocType('receipt')}
                                        />
                                        <span className="ml-2">領収書</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input 
                                            type="radio" 
                                            name="docType" 
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            checked={docType === 'invoice'}
                                            onChange={() => setDocType('invoice')}
                                        />
                                        <span className="ml-2">請求書</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行対象の費用</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input 
                                            type="radio" 
                                            name="splitType" 
                                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                            checked={splitType === 'combined'}
                                            onChange={() => setSplitType('combined')}
                                        />
                                        <span className="ml-2">合算</span>
                                    </label>
                                    
                                    {data.lecture_fee > 0 && (
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="splitType" 
                                                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                checked={splitType === 'lecture'}
                                                onChange={() => setSplitType('lecture')}
                                            />
                                            <span className="ml-2">受講費のみ</span>
                                        </label>
                                    )}

                                    {data.social_fee > 0 && (
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="splitType" 
                                                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                checked={splitType === 'social'}
                                                onChange={() => setSplitType('social')}
                                            />
                                            <span className="ml-2">懇親会費のみ</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    宛名 <span className="text-xs text-gray-500">（会社名などに変更可能です）</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={addressee}
                                    onChange={(e) => setAddressee(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                                />
                            </div>
                        </div>

                        {/* 右：日付と支払方法 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {docType === 'receipt' ? '領収日（お支払日）' : '請求日'}
                                </label>
                                <input 
                                    type="date"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                                />
                            </div>

                            {docType === 'receipt' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">お支払い方法</label>
                                    <select 
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border bg-white"
                                    >
                                        <option value="銀行振込">銀行振込</option>
                                        <option value="クレジットカード">クレジットカード</option>
                                        <option value="現金">現金</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* エラー / 成功メッセージ */}
                    {errorMsg && (
                        <div className="mt-6 p-3 bg-red-100 text-red-700 border border-red-400 rounded">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mt-6 p-3 bg-green-100 text-green-700 border border-green-400 rounded">
                            {successMsg}
                        </div>
                    )}

                    {/* アクションボタン */}
                    <div className="mt-8 border-t pt-6 text-center">
                        <p className="text-sm text-gray-600 mb-4">
                            ※ 下記のボタンを押すと、印刷プレビューが開きます。<br/>
                            送信先（プリンター）を「**PDFに保存**」にして保存してください。
                        </p>
                        
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || (!data.isAdmin && isCurrentDocIssued)}
                            className={`px-8 py-3 text-white font-bold rounded shadow-lg text-lg transition-colors ${
                                isGenerating || (!data.isAdmin && isCurrentDocIssued)
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {isGenerating ? '準備中...' : `${docType === 'receipt' ? '領収書' : '請求書'}（PDF）を作成する`}
                        </button>
                    </div>

                </div>
                
                <div className="text-center text-gray-400 text-sm mb-2">
                    ↓ プレビュー（この枠線以下の内容がA4サイズで印刷されます） ↓
                </div>
            </div>

            {/* ！！！ 帳票プレビュー・印刷領域（ここがA4印刷される） ！！！ */}
            {/* print:block で印刷時は常に表示、print:m-0で余白リセット */}
            <div className="max-w-[210mm] mx-auto bg-white sm:shadow-lg sm:border sm:border-gray-300 min-h-[297mm] p-[15mm] sm:p-[20mm] print:shadow-none print:border-none print:p-0 print:m-0">
                
                {/* 帳票ヘッダー */}
                <div className="flex justify-between items-end border-b-2 border-gray-800 pb-2 mb-8">
                    <h2 className="text-3xl font-serif tracking-widest text-gray-800">
                        {docType === 'receipt' ? '領 収 書' : '請 求 書'}
                    </h2>
                    <div className="text-right text-gray-700">
                        <p className="text-sm border-b border-gray-400 inline-block min-w-[120px] pb-1">
                            No. {data.id.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm mt-2">
                            発行日: {issueDate.replace(/-/g, '/')}
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-start mb-12">
                    {/* 宛名表示 */}
                    <div className="w-1/2">
                        <div className="border-b border-gray-800 pb-1 mb-2 text-xl text-gray-800 font-serif">
                            <span className="font-bold">{addressee || '　　　　　　'}</span> <span className="text-lg">様</span>
                        </div>
                        {docType === 'receipt' ? (
                            <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                                下記の金額を正に領収いたしました。<br/>
                                支払方法: {paymentMethod}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                                下記の通りご請求申し上げます。
                            </p>
                        )}
                    </div>

                    {/* 発行元情報（※適宜ダミー、後で自社フォーマットに従って差し替えるためのプレースホルダー） */}
                    <div className="w-1/2 text-right text-sm text-gray-700 leading-relaxed">
                        <p className="font-bold text-lg mb-2">神言学 運営事務局</p>
                        <p>〒100-0000</p>
                        <p>東京都千代田区〇〇 1-2-3</p>
                        <p>ビル名 4F</p>
                        <p>Email: info@example.com</p>
                        <p>登録番号: T1234567890123</p>
                    </div>
                </div>

                {/* 金額ハイライト */}
                <div className="bg-gray-100 p-6 text-center mb-10 border border-gray-300">
                    <p className="text-sm text-gray-600 mb-2">
                        {docType === 'receipt' ? '領収金額' : 'ご請求金額'}
                    </p>
                    <p className="text-4xl font-bold font-serif text-gray-800 tracking-wider">
                        {formatCurrency(totalAmount)} <span className="text-xl font-normal">-</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">（消費税 10% 込）</p>
                </div>

                {/* 明細テーブル */}
                <div className="mb-12">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-l-4 border-gray-800 pl-2">内訳明細</h3>
                    <table className="w-full border-collapse border border-gray-800 text-sm">
                        <thead>
                            <tr className="bg-gray-100 font-bold border-b border-gray-800">
                                <th className="p-3 text-left border-r border-gray-800">品目 / 詳細</th>
                                <th className="p-3 text-center border-r border-gray-800 w-24">数量</th>
                                <th className="p-3 text-right w-40">金額（税込）</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* 受講費の行 */}
                            {(splitType === 'combined' || splitType === 'lecture') && data.lecture_fee > 0 && (
                                <tr className="border-b border-gray-300">
                                    <td className="p-3 border-r border-gray-800">
                                        神言学 集中講座 受講費<br/>
                                        <span className="text-xs text-gray-500">属性: {data.applied_rank_name} / 会場: {data.venue}</span>
                                    </td>
                                    <td className="p-3 text-center border-r border-gray-800">1</td>
                                    <td className="p-3 text-right font-mono">{formatCurrency(data.lecture_fee)}</td>
                                </tr>
                            )}
                            
                            {/* 懇親会費の行 */}
                            {(splitType === 'combined' || splitType === 'social') && data.social_fee > 0 && (
                                <tr className="border-b border-gray-300">
                                    <td className="p-3 border-r border-gray-800">
                                        懇親会 参加費<br/>
                                        <span className="text-xs text-gray-500">会場: {data.social_venue}</span>
                                    </td>
                                    <td className="p-3 text-center border-r border-gray-800">1</td>
                                    <td className="p-3 text-right font-mono">{formatCurrency(data.social_fee)}</td>
                                </tr>
                            )}

                            {/* 手数料や割引などの空き行（必要に応じて） */}
                            {totalAmount === 0 && (
                                <tr className="border-b border-gray-300 text-gray-400">
                                    <td className="p-3 border-r border-gray-800 italic">該当する費用項目がありません</td>
                                    <td className="p-3 text-center border-r border-gray-800">-</td>
                                    <td className="p-3 text-right font-mono">¥0</td>
                                </tr>
                            )}

                            {/* 合計行 */}
                            <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
                                <td colSpan={2} className="p-3 text-right border-r border-gray-800">合計</td>
                                <td className="p-3 text-right font-mono text-lg">{formatCurrency(totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 備考・フッター */}
                <div className="text-xs text-gray-600 leading-relaxed">
                    <p className="font-bold mb-1">【備考】</p>
                    {docType === 'invoice' ? (
                        <>
                            <p>・お支払いは、記載の期日までにお願いいたします。</p>
                            <p>・振込手数料は貴社にてご負担くださいますようお願い申し上げます。</p>
                        </>
                    ) : (
                        <>
                            <p>・本領収書は電子的に発行されたものであり、印紙の貼付は省略しております。</p>
                        </>
                    )}
                </div>

            </div>

        </div>
    );
}
