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
                    fontFamily: '"MS Mincho", "Noto Serif JP", serif', // 明朝体ベース
                    color: '#222',
                    overflow: 'hidden'
                }}
            >
                {/* 1. タイトル（ページ全体のど真ん中） */}
                <div style={{ position: 'absolute', top: '35mm', left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: '38px', letterSpacing: '0.5em', marginLeft: '0.5em' /* letter-spacingのオフセット補正 */ }}>
                        {docType === 'receipt' ? '領 収 書' : '請 求 書'}
                    </span>
                </div>

                {/* 2. 発行日（右上寄り） */}
                <div style={{ position: 'absolute', top: '55mm', right: '35mm', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={{ fontSize: '13px', letterSpacing: '0.1em' }}>発行日</span>
                    <span style={{ 
                        fontSize: '13px', 
                        borderBottom: '1px solid #222', 
                        width: '130px', 
                        paddingBottom: '2px', 
                        textAlign: 'center' 
                    }}>
                        {issueDate.replace(/-/g, '/')}
                    </span>
                </div>

                {/* 3. 宛名（左上寄り） */}
                <div style={{ position: 'absolute', top: '75mm', left: '25mm' }}>
                    <div style={{ borderBottom: '1.5px solid #222', paddingBottom: '4px', display: 'inline-flex', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.1em', padding: '0 5px' }}>
                            {addressee}
                        </span>
                        <span style={{ fontSize: '15px', marginLeft: '12px', paddingRight: '5px' }}>
                            {honorific}
                        </span>
                    </div>
                </div>

                {/* 4. メインブロック：3本の長い罫線の部分 */}
                {/* 線のスタート位置：左から 62mm (-25mm のインデントよりさらに右) */}
                <div style={{ position: 'absolute', top: '100mm', left: '62mm', right: '35mm' }}>
                    
                    {/* 太線 1 */}
                    <div style={{ borderTop: '2px solid #222', width: '100%' }}></div>
                    
                    {/* 金額の行 */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '14mm', paddingLeft: '5mm' }}>
                        <div style={{ fontSize: '15px', letterSpacing: '0.5em', width: '50px' }}>金額</div>
                        {/* 金額は少し右寄りに置かれている（ここではフレックス構成で整える） */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            {/* フォントサイズ24px程度の金額表示（サンセリフ系） */}
                            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif', transform: 'translateY(1px)' }}>
                                ¥{totalAmount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* 太線 2 */}
                    <div style={{ borderTop: '2px solid #222', width: '100%' }}></div>

                    {/* 但し書きの行 */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '12mm', paddingLeft: '5mm' }}>
                        <div style={{ fontSize: '14px', letterSpacing: '0.3em', width: '50px' }}>但し</div>
                        <div style={{ fontSize: '13px', letterSpacing: '0.1em', paddingLeft: '10px' }}>
                            {description}
                        </div>
                    </div>

                    {/* 太線 3 */}
                    <div style={{ borderTop: '2px solid #222', width: '100%' }}></div>

                    {/* 確認テキスト（3本目の線のすぐ下） */}
                    <div style={{ paddingTop: '8px', fontSize: '13px', letterSpacing: '0.1em' }}>
                        {docType === 'receipt' ? '上記正に領収いたしました。' : '上記の通りご請求申し上げます。'}
                    </div>

                </div>

                {/* 5. 内訳テーブル（左下） */}
                {/* 左から 25mm（宛名と同じライン） */}
                <div style={{ position: 'absolute', bottom: '30mm', left: '25mm', width: '75mm', fontSize: '11px' }}>
                    <div style={{ borderBottom: '1px solid #111', paddingBottom: '3px', marginBottom: '0', display: 'flex' }}>
                        <span style={{ flex: 1, textAlign: 'center', letterSpacing: '0.5em' }}>内訳</span>
                        <span style={{ flex: 1 }}></span>
                    </div>
                    {/* 10% */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, borderRight: '1px solid #fff', padding: '3px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px' }}>
                                <span>税率</span>
                                <span>税別金額</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, padding: '4px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px', paddingRight: '10px' }}>
                                <span style={{ fontFamily: 'sans-serif' }}>10%</span>
                                <span style={{ fontFamily: 'sans-serif', textAlign: 'right' }}>
                                    {(taxInfo[10]?.amount > 0) ? `¥${taxInfo[10].base.toLocaleString()}` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, padding: '4px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px', paddingRight: '10px' }}>
                                <span>消費税額</span>
                                <span style={{ fontFamily: 'sans-serif', textAlign: 'right' }}>
                                    {(taxInfo[10]?.amount > 0) ? `¥${taxInfo[10].tax.toLocaleString()}` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* 8% */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, borderRight: '1px solid #fff', padding: '3px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px' }}>
                                <span>税率</span>
                                <span>税別金額</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, padding: '4px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px', paddingRight: '10px' }}>
                                <span style={{ fontFamily: 'sans-serif' }}>8%</span>
                                <span style={{ fontFamily: 'sans-serif', textAlign: 'right' }}>
                                    {(taxInfo[8]?.amount > 0) ? `¥${taxInfo[8].base.toLocaleString()}` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                        <div style={{ flex: 1, padding: '4px 2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px', paddingRight: '10px' }}>
                                <span>消費税額</span>
                                <span style={{ fontFamily: 'sans-serif', textAlign: 'right' }}>
                                    {(taxInfo[8]?.amount > 0) ? `¥${taxInfo[8].tax.toLocaleString()}` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. 会社情報・社印（右下） */}
                <div style={{ position: 'absolute', bottom: '30mm', right: '35mm' }}>
                    <div style={{ fontSize: '10px', lineHeight: '2.0', letterSpacing: '0.05em', position: 'relative', zIndex: 10 }}>
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
                    {/* 社印（文字にマルチプライで乗せる） */}
                    <img
                        src="/images/hanko.png"
                        alt=""
                        style={{
                            position: 'absolute',
                            bottom: '0px',
                            right: '-15px',
                            width: '65px',
                            height: '65px',
                            mixBlendMode: 'multiply',
                            opacity: 0.85,
                            zIndex: 1
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
