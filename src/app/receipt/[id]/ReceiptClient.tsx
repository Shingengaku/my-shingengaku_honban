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
    const [docType, setDocType] = useState<'receipt' | 'invoice'>('receipt');
    const [splitType, setSplitType] = useState<SplitType>('combined');
    const [addressee, setAddressee] = useState(data.input_name);
    const [honorific, setHonorific] = useState('御中');
    const [description, setDescription] = useState('受講費用・懇親会費用として');
    const today = new Date().toISOString().split('T')[0];
    const [issueDate, setIssueDate] = useState(today);
    const [paymentMethod, setPaymentMethod] = useState('銀行振込');
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
            const apiTypeBase = docType === 'receipt' ? 'receipt_issued' : 'invoice_issued';
            const apiTypeModifier = splitType === 'combined' ? '' : (splitType === 'lecture' ? '_lecture' : '_social');
            const res = await fetch('/api/receipt/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: data.id, type: apiTypeBase + apiTypeModifier, is_admin: data.isAdmin })
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
                                    <label className="flex items-center"><input type="radio" name="docType" className="w-4 h-4 text-indigo-600 mr-2" checked={docType === 'receipt'} onChange={() => setDocType('receipt')} />領収書</label>
                                    <label className="flex items-center"><input type="radio" name="docType" className="w-4 h-4 text-indigo-600 mr-2" checked={docType === 'invoice'} onChange={() => setDocType('invoice')} />請求書</label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行対象</label>
                                <div className="flex gap-4 flex-wrap">
                                    <label className="flex items-center"><input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 mr-2" checked={splitType === 'combined'} onChange={() => setSplitType('combined')} />合算</label>
                                    {data.lecture_fee > 0 && <label className="flex items-center"><input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 mr-2" checked={splitType === 'lecture'} onChange={() => setSplitType('lecture')} />受講費のみ</label>}
                                    {data.social_fee > 0 && <label className="flex items-center"><input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 mr-2" checked={splitType === 'social'} onChange={() => setSplitType('social')} />懇親会費のみ</label>}
                                </div>
                            </div>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">{docType === 'receipt' ? '領収日' : '請求日'}</label>
                                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border" />
                            </div>
                            {docType === 'receipt' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">お支払い方法</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border bg-white">
                                        <option value="銀行振込">銀行振込</option>
                                        <option value="クレジットカード">クレジットカード</option>
                                        <option value="現金">現金</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    {errorMsg && <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded text-sm">{errorMsg}</div>}
                    {successMsg && <div className="mt-4 p-3 bg-green-100 text-green-700 border border-green-400 rounded text-sm">{successMsg}</div>}
                    <div className="mt-6 border-t pt-5 text-center">
                        <p className="text-sm text-gray-600 mb-3">※ ボタンを押すと印刷ダイアログが開きます。「PDFに保存」を選択してください。</p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || (!data.isAdmin && isCurrentDocIssued)}
                            className={`px-8 py-3 text-white font-bold rounded shadow-lg text-lg transition-colors ${isGenerating || (!data.isAdmin && isCurrentDocIssued) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {isGenerating ? '準備中...' : `${docType === 'receipt' ? '領収書' : '請求書'}（PDF）を作成する`}
                        </button>
                    </div>
                </div>
            </div>

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
                className="mx-auto bg-white sm:shadow-lg sm:border sm:border-gray-200 print:shadow-none print:border-none print:m-0 box-border relative"
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
                        {docType === 'receipt' ? '領 収 書' : '請 求 書'}
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
                        {docType === 'receipt' ? '上記正に領収いたしました。' : '上記の通りご請求申し上げます。'}
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
                {docType === 'receipt' && paymentMethod !== '銀行振込' && (
                    <div style={{ position: 'absolute', bottom: '15mm', right: '35mm', fontSize: '9px', color: '#666' }}>
                        ※お支払方法: {paymentMethod}
                    </div>
                )}

                {/* 請求書のみ備考 */}
                {docType === 'invoice' && (
                    <div style={{ position: 'absolute', bottom: '15mm', left: '25mm', fontSize: '9px', color: '#333' }}>
                        <div style={{ fontWeight: 'bold' }}>【備考】</div>
                        <div>・お支払いは、記載の期日までにお願いいたします。</div>
                        <div>・振込手数料は貴社にてご負担くださいますようお願い申し上げます。</div>
                    </div>
                )}
            </div>
        </div>
    );
}
