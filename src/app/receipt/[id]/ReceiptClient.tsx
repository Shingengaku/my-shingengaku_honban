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

    const renderRates = [10, 8];

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

    // ---- レイアウト定数 ----
    // 上部のボーダーライン
    const thickLine: React.CSSProperties = {
        borderBottom: '2.5px solid #111',
        width: '100%',
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white text-gray-800 font-sans">
            {/* コントロールパネル（印刷時非表示） */}
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
                <div className="text-center text-gray-400 text-sm mb-2">↓ プレビュー（横向きA4で印刷されます） ↓</div>
            </div>

            {/* ===== @page スタイル ===== */}
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

            {/* ===== 帳票本体（横向きA4: 296.93mm × 209.97mm） ===== */}
            <div
                className="mx-auto bg-white sm:shadow-lg sm:border sm:border-gray-200 print:shadow-none print:border-none print:m-0 font-serif text-gray-900 box-border flex flex-col"
                style={{ width: '296.93mm', height: '209.97mm', padding: '14mm 16mm 12mm 16mm' }}
            >

                {/* ① タイトル + 発行日 */}
                <div style={{ position: 'relative', textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '34px', letterSpacing: '0.4em', fontWeight: 'normal', paddingRight: '0.4em' }}>
                        {docType === 'receipt' ? '領　収　書' : '請　求　書'}
                    </div>
                    {/* 発行日：右側 */}
                    <div style={{ position: 'absolute', right: 0, bottom: '-2px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.05em' }}>発行日</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', borderBottom: '1px solid #333', minWidth: '140px', textAlign: 'right', paddingBottom: '1px', paddingRight: '2px' }}>
                            {issueDate.replace(/-/g, '/')}
                        </span>
                    </div>
                </div>

                {/* ② 宛名（名前の下にだけ短い線）*/}
                <div style={{ marginBottom: '10px', marginTop: '6px', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1.5px solid #222', paddingBottom: '3px', letterSpacing: '0.1em' }}>
                        {addressee}
                    </span>
                    <span style={{ fontSize: '13px', marginLeft: '14px', letterSpacing: '0.08em' }}>{honorific}</span>
                </div>

                {/* ③ 宛名下の区切り太線 */}
                <div style={thickLine} />

                {/* ④ 金額行 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 8px 10px 8px', borderBottom: '2.5px solid #111' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.6em', marginRight: '16px', whiteSpace: 'nowrap' }}>金　額</span>
                    <span style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'monospace', flex: 1 }}>
                        ¥{totalAmount.toLocaleString()} -
                    </span>
                    {docType === 'receipt' && (
                        <span style={{ fontSize: '9px', color: '#666', whiteSpace: 'nowrap' }}>※お支払方法: {paymentMethod}</span>
                    )}
                </div>

                {/* ⑤ 但し書き行 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 8px 10px 8px', borderBottom: '2.5px solid #111' }}>
                    <span style={{ fontSize: '14px', letterSpacing: '0.5em', marginRight: '16px', whiteSpace: 'nowrap' }}>但　し</span>
                    <span style={{ fontSize: '12px', letterSpacing: '0.08em' }}>{description}</span>
                </div>

                {/* ⑥ 確認文言 */}
                <div style={{ fontSize: '12px', letterSpacing: '0.15em', padding: '10px 0 0 40px' }}>
                    {docType === 'receipt' ? '上記正に領収いたしました。' : '上記の通りご請求申し上げます。'}
                </div>

                {/* スペーサー */}
                <div style={{ flex: 1 }} />

                {/* ⑦ 下部: 内訳 + 会社情報+社印 */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px' }}>

                    {/* 内訳（2列形式：左列に税率%と消費税額ラベル、右列に金額） */}
                    <div style={{ fontSize: '9px', minWidth: '140px', maxWidth: '180px' }}>
                        {/* 内訳 ヘッダー */}
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', borderBottom: '1px solid #333', paddingBottom: '2px', marginBottom: '0' }}>
                            内訳
                        </div>
                        {/* 各税率ブロック */}
                        {renderRates.map((rate) => {
                            const rateBase = (taxInfo[rate] && taxInfo[rate].base) || 0;
                            const rateTax = (taxInfo[rate] && taxInfo[rate].tax) || 0;
                            return (
                                <div key={rate}>
                                    {/* ヘッダー行（税率/税別金額） */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #aaa', padding: '2px 2px' }}>
                                        <span style={{ flex: '0 0 50px' }}>税率</span>
                                        <span style={{ flex: 1, textAlign: 'right' }}>税別金額</span>
                                    </div>
                                    {/* データ行1: 税率% と 税別金額の値 */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #aaa', padding: '3px 2px' }}>
                                        <span style={{ flex: '0 0 50px', fontWeight: 'bold' }}>{rate}%</span>
                                        <span style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace' }}>
                                            {rateBase > 0 ? `¥${rateBase.toLocaleString()}` : ''}
                                        </span>
                                    </div>
                                    {/* データ行2: 消費税額ラベル と 消費税額の値 */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #ccc', padding: '2px 2px' }}>
                                        <span style={{ flex: '0 0 50px', color: '#444' }}>消費税額</span>
                                        <span style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace' }}>
                                            {rateTax > 0 ? `¥${rateTax.toLocaleString()}` : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 会社情報 + 社印（社印が会社情報の右側にかぶさる） */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ fontSize: '10px', lineHeight: '1.8', letterSpacing: '0.03em', textAlign: 'left' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>株式会社フィールドオブドリームス</div>
                                <div>〒810-0044</div>
                                <div>福岡市中央区六本松2-3-6 9F</div>
                                <div>T2290001075481</div>
                                <div>TEL：092-791-4547</div>
                                <div>FAX：092-791-4548</div>
                            </div>
                            {/* 社印：会社情報の右上にかぶさる */}
                            <img
                                src="/images/hanko.png"
                                alt=""
                                style={{
                                    position: 'absolute',
                                    top: '0',
                                    right: '-65px',
                                    width: '65px',
                                    height: '65px',
                                    mixBlendMode: 'multiply',
                                    opacity: 0.92
                                }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        </div>
                    </div>

                </div>

                {/* 請求書のみ備考 */}
                {docType === 'invoice' && (
                    <div style={{ marginTop: '12px', fontSize: '9px', color: '#333', lineHeight: 1.6, borderTop: '1px solid #ccc', paddingTop: '8px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>【備考】</div>
                        <div>・お支払いは、記載の期日までにお願いいたします。</div>
                        <div>・振込手数料は貴社にてご負担くださいますようお願い申し上げます。</div>
                    </div>
                )}
            </div>
        </div>
    );
}
