'use client';

import { useState } from 'react';

export interface ReceiptData {
    id: string;
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

const HANKO_B64 = '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';

export default function ReceiptClient({ data }: { data: ReceiptData }) {
    const docType = 'receipt';
    
    // 手数料の有無によって初期値を決定
    const initialSplitType: SplitType = (data.lecture_fee > 0 && data.social_fee > 0) ? 'combined' : (data.lecture_fee > 0 ? 'lecture' : 'social');
    const initialDescription = initialSplitType === 'combined' ? '受講費用、懇親会費用として' : (initialSplitType === 'lecture' ? '受講費用のみ' : '懇親会費用のみ');

    const [splitType, setSplitType] = useState<SplitType>(initialSplitType);
    const [addressee, setAddressee] = useState(data.input_name);
    const [honorific, setHonorific] = useState('御中');
    const [description, setDescription] = useState(initialDescription);

    // タグから初期値を抽出
    const initialIssueDate = data.tags.find(t => t.startsWith('rd:'))?.split(':')[1] || '';
    const initialPaymentMethod = data.tags.find(t => t.startsWith('pm:'))?.split(':')[1] || '銀行振込';

    const [issueDate, setIssueDate] = useState(initialIssueDate);
    const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isDocIssued = (checkDocType: 'receipt' | 'invoice', checkSplitType: SplitType) => {
        const prefix = checkDocType === 'receipt' ? 'receipted' : 'invoiced';
        let exactTag = prefix;
        if (checkSplitType === 'lecture') exactTag += '_lecture';
        if (checkSplitType === 'social') exactTag += '_social';
        if (data.tags.includes(exactTag)) return true;
        if (checkSplitType === 'combined') {
            if (data.tags.includes(prefix + '_lecture') || data.tags.includes(prefix + '_social')) return true;
        }
        if (checkSplitType !== 'combined') {
            if (data.tags.includes(prefix)) return true;
        }
        return false;
    };

    const isCurrentDocIssued = isDocIssued(docType, splitType);

    let totalAmount = 0;
    if (splitType === 'combined') totalAmount = data.lecture_fee + data.social_fee;
    else if (splitType === 'lecture') totalAmount = data.lecture_fee;
    else if (splitType === 'social') totalAmount = data.social_fee;

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

    const handleGenerate = async () => {
        if (!data.isAdmin && isCurrentDocIssued) {
            setErrorMsg('既に発行済みです。再発行が必要な場合は管理者へお問い合わせください。');
            return;
        }
        setIsGenerating(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            const apiTypeBase = 'receipt_issued';
            const apiTypeModifier = splitType === 'combined' ? '' : (splitType === 'lecture' ? '_lecture' : '_social');
            
            // タグの構築 (既存タグを保持しつつ更新)
            const tagMap: Record<string, string> = {
                'receipt_issued': 'receipted',
                'receipt_issued_lecture': 'receipted_lecture',
                'receipt_issued_social': 'receipted_social'
            };
            const tagToAdd = tagMap[apiTypeBase + apiTypeModifier];
            
            let newTags = [...data.tags.filter(t => !t.startsWith('rd:') && !t.startsWith('pm:'))];
            if (issueDate) newTags.push(`rd:${issueDate}`);
            if (paymentMethod) newTags.push(`pm:${paymentMethod}`);
            if (tagToAdd && !newTags.includes(tagToAdd)) newTags.push(tagToAdd);

            const res = await fetch('/api/receipt/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: data.id, 
                    type: apiTypeBase + apiTypeModifier, 
                    is_admin: data.isAdmin,
                    tags: newTags
                })
            });
            const resData = await res.json();
            if (!res.ok) {
                setErrorMsg(resData.error === 'ALREADY_ISSUED' ? resData.message : 'エラー: ' + (resData.error || ''));
                setIsGenerating(false);
                return;
            }
            setSuccessMsg('準備完了。印刷ダイアログが開きます。');
            setTimeout(() => { window.print(); setIsGenerating(false); }, 500);
        } catch (e: any) {
            setErrorMsg('通信エラー: ' + e.message);
            setIsGenerating(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white text-gray-800 font-sans">
            {/* プレビュー外のコントロール群 */}
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 print:hidden">
                <div className="bg-white shadow rounded-lg p-6 mb-8 border border-gray-200">
                    <h1 className="text-2xl font-bold mb-6 text-indigo-700">
                        {data.isAdmin ? '【管理者用】書類発行ツール' : '書類発行（PDF保存）'}
                    </h1>
                    {data.isAdmin && (
                        <>
                            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                <strong>管理者モード:</strong> 発行制限を無視して作成可能です。
                            </div>
                            {data.is_amount_mismatched && (
                                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-sm font-bold text-red-800">
                                    ⚠️ 金額アンマッチ: 自動算出額（{formatCurrency(data.lecture_fee + data.social_fee)}）と決済登録額（{formatCurrency(data.total_amount_from_db || 0)}）が不一致。
                                </div>
                            )}
                        </>
                    )}
                    {!data.isAdmin && isCurrentDocIssued && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            <strong>※ご注意:</strong> 既に発行済みです。再発行は管理者へお問い合わせください。
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行する書類</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center text-indigo-700 font-bold">
                                        領収書
                                    </label>
                                </div>
                            </div>
                            {(data.lecture_fee > 0 && data.social_fee > 0) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">発行対象</label>
                                    <div className="flex gap-4 flex-wrap">
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="splitType" 
                                                className="w-4 h-4 text-indigo-600 mr-2" 
                                                checked={splitType === 'combined'} 
                                                onChange={() => {
                                                    setSplitType('combined');
                                                    setDescription('受講費用、懇親会費用として');
                                                }} 
                                            />
                                            合算
                                        </label>
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="splitType" 
                                                className="w-4 h-4 text-indigo-600 mr-2" 
                                                checked={splitType === 'lecture'} 
                                                onChange={() => {
                                                    setSplitType('lecture');
                                                    setDescription('受講費用のみ');
                                                }} 
                                            />
                                            受講費のみ
                                        </label>
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="splitType" 
                                                className="w-4 h-4 text-indigo-600 mr-2" 
                                                checked={splitType === 'social'} 
                                                onChange={() => {
                                                    setSplitType('social');
                                                    setDescription('懇親会費用のみ');
                                                }} 
                                            />
                                            懇親会費のみ
                                        </label>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">宛名</label>
                                    <input type="text" value={addressee} onChange={e => setAddressee(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border" />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">敬称</label>
                                    <select value={honorific} onChange={e => setHonorific(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border bg-white">
                                        <option value="御中">御中</option>
                                        <option value="様">様</option>
                                        <option value="">なし</option>
                                        <option value="行">行</option>
                                        <option value="殿">殿</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">但し書き</label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    領収日 {!data.isAdmin && <span className="text-[10px] text-gray-400 font-normal ml-1">(事務局設定済み)</span>}
                                </label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={issueDate} 
                                        onChange={e => setIssueDate(e.target.value)} 
                                        disabled={!data.isAdmin}
                                        className={`w-full rounded-md shadow-sm text-sm p-2 border ${!data.isAdmin ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed select-none' : 'bg-white border-gray-300'}`} 
                                    />
                                    {!data.isAdmin && (
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <span className="text-xs text-gray-400">🔒</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    お支払い方法 {!data.isAdmin && <span className="text-[10px] text-gray-400 font-normal ml-1">(事務局設定済み)</span>}
                                </label>
                                <div className="relative">
                                    <select 
                                        value={paymentMethod} 
                                        onChange={e => setPaymentMethod(e.target.value)} 
                                        disabled={!data.isAdmin}
                                        className={`w-full rounded-md shadow-sm text-sm p-2 border ${!data.isAdmin ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed select-none appearance-none' : 'bg-white border-gray-300'}`}
                                    >
                                        <option value="銀行振込">銀行振込</option>
                                        <option value="クレジットカード">クレジットカード</option>
                                        <option value="現金">現金</option>
                                    </select>
                                    {!data.isAdmin && (
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <span className="text-xs text-gray-400">🔒</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {errorMsg && <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded text-sm">{errorMsg}</div>}
                    {successMsg && <div className="mt-4 p-3 bg-green-100 text-green-700 border border-green-400 rounded text-sm">{successMsg}</div>}
                    <div className="mt-6 border-t pt-5 text-center">
                        {!data.isAdmin && (!issueDate || !paymentMethod) ? (
                            <div className="p-4 bg-gray-100 text-gray-600 rounded border border-gray-300 mb-3">
                                事務局による領収情報の登録後に発行可能となります。しばらくお待ちください。
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 mb-3">※ ボタンを押すと印刷ダイアログが開きます。「PDFに保存」を選択してください。</p>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || (!data.isAdmin && isCurrentDocIssued) || (!data.isAdmin && (!issueDate || !paymentMethod))}
                                    className={`px-8 py-3 text-white font-bold rounded shadow-lg text-lg transition-colors ${isGenerating || (!data.isAdmin && isCurrentDocIssued) || (!data.isAdmin && (!issueDate || !paymentMethod)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {isGenerating ? '準備中...' : '領収書（PDF）を作成する'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== プレビューセクションのヘッダー ===== */}
            <div className="max-w-[296.93mm] mx-auto px-4 print:hidden mb-4">
                <div className="bg-indigo-600 text-white p-3 rounded-t-lg flex items-center justify-between shadow-md">
                    <h2 className="font-bold flex items-center gap-2">
                        <span className="text-xl">👁️</span> 書類プレビュー
                    </h2>
                    <span className="text-xs opacity-80">※以下の内容がそのままPDFになります</span>
                </div>
            </div>

            {/* ===== 帳票本体の表示エリア（ブラウザでは少し縮小して見やすくする） ===== */}
            <div className="print:m-0 print:p-0 pb-20 flex flex-col items-center">
                <div className="print:m-0 print:p-0 transform scale-[0.3] sm:scale-[0.4] md:scale-[0.55] lg:scale-[0.75] xl:scale-100 origin-top">

            {/* ===== 印刷用スタイル ===== */}
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


            {/* ===== 帳票本体 ===== */}
            {/*
                A4横: 296.93mm × 209.97mm
                全体の構造をフラットに保ち、精密なマージン等でレイアウトする。
            */}
            <div
                className="bg-white shadow-2xl print:shadow-none border border-gray-100 print:border-none box-border relative overflow-hidden"
                style={{ 
                    width: '296.93mm', 
                    height: '209.97mm', 
                    fontFamily: '"MS Mincho", "Noto Serif JP", serif',
                    color: '#222'
                }}
            >
                {/* 1. タイトル（ページ全体のど真ん中） */}
                <div style={{ position: 'absolute', top: '35mm', left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: '38px', fontWeight: 'bold', letterSpacing: '0.5em', marginLeft: '0.5em' }}>
                        領 収 書
                    </span>
                </div>

                {/* 2. 発行日（右上寄り） */}
                <div style={{ position: 'absolute', top: '55mm', right: '35mm', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={{ fontSize: '14px', letterSpacing: '0.1em' }}>発行日</span>
                    <span style={{ 
                        fontSize: '15px', 
                        borderBottom: '1.2px solid #222', 
                        width: '135px', 
                        paddingBottom: '2px', 
                        textAlign: 'center' 
                    }}>
                        {issueDate.replace(/-/g, '/')}
                    </span>
                </div>

                {/* 3. 宛名（左上寄り）／下線は「領」の手前くらいまで */}
                <div style={{ position: 'absolute', top: '75mm', left: '25mm', width: '105mm' }}>
                    <div style={{ borderBottom: '1.5px solid #222', paddingBottom: '4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.1em', padding: '0 5px', flex: 1 }}>
                            {addressee}
                        </span>
                        <span style={{ fontSize: '15px', paddingRight: '5px' }}>
                            {honorific}
                        </span>
                    </div>
                </div>

                {/* 4. メインブロック：3本の長い罫線の部分 */}
                {/* 線のスタート位置：左から 62mm、少し上に移動(90mm)、横幅は発行日くらいまで(185mm) */}
                <div style={{ position: 'absolute', top: '90mm', left: '62mm', width: '185mm' }}>
                    
                    {/* 太線 1 */}
                    <div style={{ borderTop: '3px solid #111', width: '100%' }}></div>
                    
                    {/* 金額の行 */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '14mm', paddingLeft: '5mm' }}>
                        <div style={{ fontSize: '15px', letterSpacing: '0.5em', width: '50px' }}>金額</div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif', transform: 'translateY(1px)' }}>
                                ¥{totalAmount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* 太線 2 */}
                    <div style={{ borderTop: '3px solid #111', width: '100%' }}></div>

                    {/* 但し書きの行 */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '12mm', paddingLeft: '5mm' }}>
                        <div style={{ fontSize: '14px', letterSpacing: '0.3em', width: '50px' }}>但し</div>
                        <div style={{ fontSize: '13px', letterSpacing: '0.1em', paddingLeft: '10px' }}>
                            {description}
                        </div>
                    </div>

                    {/* 太線 3 */}
                    <div style={{ borderTop: '3px solid #111', width: '100%' }}></div>

                    {/* 確認テキスト（3本目の線のすぐ下） */}
                    <div style={{ paddingTop: '8px', fontSize: '13px', letterSpacing: '0.1em' }}>
                        上記正に領収いたしました。
                    </div>

                </div>

                {/* 5. 内訳テーブル（左下） */}
                {/* 左から 25mm（宛名と同じライン） */}
                <div style={{ position: 'absolute', bottom: '30mm', left: '25mm', width: '75mm', fontSize: '11px', letterSpacing: '0.1em' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4px', letterSpacing: '0.4em' }}>内訳</div>
                    <div style={{ borderTop: '1.5px solid #222', width: '100%' }}></div>
                    
                    {/* 10%ブロック */}
                    <div style={{ padding: '6px 0 2px 0' }}>
                        <div style={{ display: 'flex', marginBottom: '2px' }}>
                            <span style={{ width: '45px' }}>税率</span>
                            <span style={{ flex: 1, paddingLeft: '10px' }}>税別金額</span>
                        </div>
                        <div style={{ display: 'flex', marginBottom: '4px' }}>
                            <span style={{ width: '45px', fontFamily: 'sans-serif' }}>10%</span>
                            <span style={{ flex: 1, textAlign: 'right', fontFamily: 'sans-serif', paddingRight: '10px' }}>
                                {(taxInfo[10]?.amount > 0) ? `¥${taxInfo[10].base.toLocaleString()}` : ''}
                            </span>
                        </div>
                        {/* ★ここの線は右側のみ（「税率」列の下には引かない） */}
                        <div style={{ display: 'flex' }}>
                            <div style={{ width: '45px' }}></div>
                            <div style={{ flex: 1, borderTop: '1px solid #222' }}></div>
                        </div>
                        <div style={{ display: 'flex', marginTop: '4px', marginBottom: '2px' }}>
                            <span style={{ width: '45px' }}></span>
                            <span style={{ flex: 1, display: 'flex', paddingLeft: '10px' }}>
                                <span style={{ flex: 1 }}>消費税額</span>
                                <span style={{ textAlign: 'right', fontFamily: 'sans-serif', paddingRight: '10px' }}>
                                    {(taxInfo[10]?.amount > 0) ? `¥${taxInfo[10].tax.toLocaleString()}` : ''}
                                </span>
                            </span>
                        </div>
                    </div>
                    
                    <div style={{ borderTop: '1.5px solid #222', width: '100%' }}></div>

                    {/* 8%ブロック */}
                    <div style={{ padding: '6px 0 2px 0' }}>
                        <div style={{ display: 'flex', marginBottom: '2px' }}>
                            <span style={{ width: '45px' }}>税率</span>
                            <span style={{ flex: 1, paddingLeft: '10px' }}>税別金額</span>
                        </div>
                        <div style={{ display: 'flex', marginBottom: '4px' }}>
                            <span style={{ width: '45px', fontFamily: 'sans-serif' }}>8%</span>
                            <span style={{ flex: 1, textAlign: 'right', fontFamily: 'sans-serif', paddingRight: '10px' }}>
                                {(taxInfo[8]?.amount > 0) ? `¥${taxInfo[8].base.toLocaleString()}` : ''}
                            </span>
                        </div>
                        {/* ★ここの線は右側のみ */}
                        <div style={{ display: 'flex' }}>
                            <div style={{ width: '45px' }}></div>
                            <div style={{ flex: 1, borderTop: '1px solid #222' }}></div>
                        </div>
                        <div style={{ display: 'flex', marginTop: '4px', marginBottom: '2px' }}>
                            <span style={{ width: '45px' }}></span>
                            <span style={{ flex: 1, display: 'flex', paddingLeft: '10px' }}>
                                <span style={{ flex: 1 }}>消費税額</span>
                                <span style={{ textAlign: 'right', fontFamily: 'sans-serif', paddingRight: '10px' }}>
                                    {(taxInfo[8]?.amount > 0) ? `¥${taxInfo[8].tax.toLocaleString()}` : ''}
                                </span>
                            </span>
                        </div>
                    </div>

                    <div style={{ borderTop: '1.5px solid #222', width: '100%' }}></div>
                </div>

                {/* 6. 会社情報・社印（右下） */}
                {/* 会社情報のブロックは広めに確保し、右端に社印を置く */}
                <div style={{ position: 'absolute', bottom: '30mm', right: '35mm', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '10px', lineHeight: '2.0', letterSpacing: '0.05em' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', letterSpacing: '0.1em' }}>
                            株式会社フィールドオブドリームス
                        </div>
                        <div style={{ paddingLeft: '25mm' }}>
                            <div>〒810-0044</div>
                            <div>福岡市中央区六本松2-3-6 9F</div>
                            <div style={{ fontFamily: 'sans-serif', fontSize: '11px', transform: 'scale(0.9)', transformOrigin: 'left' }}>T2290001075481</div>
                            <div style={{ fontFamily: 'sans-serif', fontSize: '10px' }}>TEL：092-791-4547</div>
                            <div style={{ fontFamily: 'sans-serif', fontSize: '10px' }}>FAX：092-791-4548</div>
                        </div>
                    </div>
                    {/* 社印（文字に被らないよう完全に右側に配置） */}
                    <img
                        src={`data:image/png;base64,${HANKO_B64}`}
                        alt="社印"
                        style={{
                            width: '65px',
                            height: '65px',
                            mixBlendMode: 'multiply',
                            opacity: 0.85,
                            transform: 'translateY(18px)'
                        }}
                    />
                </div>

                        {/* お支払い方法（受講費の場合、参考画像にはないが表示しておくか判断が要るが、邪魔にならない場所に小さく） */}
                        {paymentMethod !== '銀行振込' && (
                            <div style={{ position: 'absolute', bottom: '15mm', right: '35mm', fontSize: '9px', color: '#666' }}>
                                ※お支払方法: {paymentMethod}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
