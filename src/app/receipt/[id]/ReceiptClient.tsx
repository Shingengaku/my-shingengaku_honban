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
    tax_rate_lecture: number;
    tax_rate_social: number;
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
    const [honorific, setHonorific] = useState('御中');
    const [description, setDescription] = useState('受講費用・懇親会費用として');
    
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

    // 税計算 (内税)
    const taxInfo: { [key: number]: { amount: number, base: number, tax: number } } = {
        10: { amount: 0, base: 0, tax: 0 },
        8: { amount: 0, base: 0, tax: 0 }
    };

    if (splitType === 'combined' || splitType === 'lecture') {
        const rate = Number(data.tax_rate_lecture) || 10;
        if (!taxInfo[rate]) taxInfo[rate] = { amount: 0, base: 0, tax: 0 };
        taxInfo[rate].amount += data.lecture_fee;
    }
    if (splitType === 'combined' || splitType === 'social') {
        const rate = Number(data.tax_rate_social) || 10;
        if (!taxInfo[rate]) taxInfo[rate] = { amount: 0, base: 0, tax: 0 };
        taxInfo[rate].amount += data.social_fee;
    }

    Object.keys(taxInfo).forEach(key => {
        const rateObj = taxInfo[Number(key)];
        if (rateObj.amount > 0) {
            rateObj.base = Math.round(rateObj.amount / (1 + (Number(key) / 100)));
            rateObj.tax = rateObj.amount - rateObj.base;
        }
    });

    const ratesConfigured = Object.keys(taxInfo).map(Number).filter(k => taxInfo[k].amount > 0).sort((a, b) => b - a);
    
    // 規定で10%と8%の行枠をPNGフォーマット通りに用意する
    const renderRates = [10, 8];

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

                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
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
                                <div className="w-24">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">敬称</label>
                                    <select 
                                        value={honorific} 
                                        onChange={(e) => setHonorific(e.target.value)}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border bg-white"
                                    >
                                        <option value="御中">御中</option>
                                        <option value="様">様</option>
                                        <option value="">なし</option>
                                        <option value="行">行</option>
                                        <option value="殿">殿</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    但し書き
                                </label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
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

            {/* ！！！ 帳票プレビュー・印刷領域（ここが指定サイズで印刷される） ！！！ */}
            <style>{`
                @media print {
                    @page {
                        size: 296.93mm 209.97mm;
                        margin: 0;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
            {/* print:block で印刷時は常に表示、print:m-0で余白リセット */}
            <div className="w-[296.93mm] h-[209.97mm] mx-auto bg-white sm:shadow-lg sm:border sm:border-gray-300 p-[15mm] sm:p-[20mm] print:shadow-none print:border-none print:p-0 print:m-0 relative font-serif text-gray-900 box-border overflow-hidden">
                
                {/* 帳票ヘッダー (PNG再現) */}
                <div className="flex justify-between items-start mb-6 pt-4">
                    <div className="w-1/2">
                    </div>
                    <div className="text-right w-1/2 mt-8">
                        <h2 className="text-4xl tracking-[1em] mb-4 pr-4">
                            {docType === 'receipt' ? '領収書' : '請求書'}
                        </h2>
                        <div className="flex justify-end gap-2 pr-4 mt-10">
                            <span className="text-sm">発行日</span>
                            <span className="text-base min-w-[120px] pb-1">{issueDate.replace(/-/g, '/')}</span>
                        </div>
                    </div>
                </div>

                {/* 宛名表示 */}
                <div className="mb-10 w-2/3 border-b border-gray-900 pb-1 flex items-end">
                    <span className="text-2xl font-bold tracking-widest px-2">{addressee}</span>
                    <span className="text-xl ml-4 mb-0.5">{honorific}</span>
                </div>

                {/* 金額・但し書き エリア */}
                <div className="mb-20 space-y-8 pl-4">
                    <div className="flex items-center">
                        <span className="text-2xl font-bold tracking-[0.5em] w-24">金額</span>
                        <div className="border-b-2 border-gray-900 min-w-[300px] text-center pb-1">
                            <span className="text-3xl font-bold font-mono px-4">¥{totalAmount.toLocaleString()} -</span>
                        </div>
                        {docType === 'receipt' ? (
                            <span className="text-sm text-gray-600 ml-4 mb-2 -translate-y-2">※お支払方法: {paymentMethod}</span>
                        ) : null}
                    </div>

                    <div className="flex items-start">
                        <span className="text-xl tracking-[1em] w-24 mt-2">但し</span>
                        <div className="border-b border-gray-900 min-w-[300px] text-center pb-1">
                            <span className="text-xl tracking-wider px-2">{description || '　　　　　　　　　　　　　'}</span>
                        </div>
                    </div>

                    <div className="pl-24 pt-4 tracking-widest">
                        {docType === 'receipt' ? '上記正に領収いたしました。' : '上記の通りご請求申し上げます。'}
                    </div>
                </div>

                {/* 下部領域: 内訳(左) & 会社情報・印(右) */}
                <div className="flex justify-between items-end mt-20 relative">
                    
                    {/* 内訳テーブル (PGN再現) */}
                    <div className="w-64 border border-gray-900">
                        <div className="text-center border-b border-gray-900 py-1 tracking-widest font-bold">内訳</div>
                        
                        <div className="flex text-sm text-center border-b border-gray-900 py-1">
                            <div className="w-16 border-r border-gray-900">税率</div>
                            <div className="flex-1">税別金額</div>
                        </div>

                        {renderRates.map((rate, index) => {
                            const isLast = index === renderRates.length - 1;
                            const rateBase = (taxInfo[rate] && taxInfo[rate].base) || 0;
                            const rateTax = (taxInfo[rate] && taxInfo[rate].tax) || 0;
                            
                            return (
                                <div key={rate} className={`flex text-sm border-gray-900 ${!isLast ? 'border-b' : ''}`}>
                                    <div className="w-16 text-center border-r border-gray-900">
                                        <div className="py-2 border-b border-gray-900">{rate}%</div>
                                        <div className="py-2 text-xs">消費税額</div>
                                    </div>
                                    <div className="flex-1 font-mono text-right pr-4">
                                        <div className="py-2 border-b border-gray-900">
                                            {rateBase > 0 ? `¥${rateBase.toLocaleString()}` : ''}
                                        </div>
                                        <div className="py-2">
                                            {rateTax > 0 ? `¥${rateTax.toLocaleString()}` : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 会社情報 & 角印 */}
                    <div className="text-right leading-loose tracking-wider relative pr-4">
                        <p className="font-bold text-lg mb-2">株式会社フィールドオブドリームス</p>
                        <p>〒810-0044</p>
                        <p>福岡市中央区六本松2-3-6 9F</p>
                        <p>T2290001075481</p>
                        <p>TEL: 092-791-4547</p>
                        <p>FAX: 092-791-4548</p>
                        
                        {/* 角印画像: /images/hanko.png が存在すると仮定し、ここに重ねる。実際のパスが異なる場合はユーザー環境に合わせて変更 */}
                        <img 
                            src="/images/hanko.png" 
                            alt="社印"
                            className="absolute bottom-[-10px] right-[-10px] w-24 h-24 opacity-90mix-blend-multiply" 
                            style={{ 
                                mixBlendMode: 'multiply',
                            }}
                            onError={(e) => { 
                                // 画像パスがない場合のフォールバック（透明や空にする等）
                                e.currentTarget.style.display = 'none'; 
                            }} 
                        />
                    </div>

                </div>
                
                {/* 備考（必要に応じて） */}
                {docType === 'invoice' && (
                    <div className="mt-8 text-xs text-gray-700 leading-relaxed border-t border-gray-400 pt-4">
                        <p className="font-bold mb-1">【備考】</p>
                        <p>・お支払いは、記載の期日までにお願いいたします。</p>
                        <p>・振込手数料は貴社にてご負担くださいますようお願い申し上げます。</p>
                    </div>
                )}
            </div>

        </div>
    );
}
