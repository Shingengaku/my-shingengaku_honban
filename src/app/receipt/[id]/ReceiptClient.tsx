'use client';

import { useState } from 'react';

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

    // 10%, 8% の行を必ず表示
    const renderRates = [10, 8];

    const handleGenerate = async () => {
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

            setSuccessMsg('書類の準備ができました。印刷ダイアログが開きます。');
            
            setTimeout(() => {
                window.print();
                setIsGenerating(false);
            }, 500);

        } catch (e: any) {
            setErrorMsg('通信エラーが発生しました: ' + e.message);
            setIsGenerating(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
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
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                            <strong>管理者モード:</strong> 発行制限テストなどを無視して作成可能です。
                        </div>
                        {data.is_amount_mismatched && (
                            <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded text-sm font-bold text-red-800">
                                ⚠️ 金額アンマッチ警告: 商品マスタおよび設定から自動算出した合計金額（{formatCurrency(data.lecture_fee + data.social_fee)}）と、決済時の登録額（{formatCurrency(data.total_amount_from_db || 0)}）が一致していません。
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
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行する書類</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input type="radio" name="docType" className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" checked={docType === 'receipt'} onChange={() => setDocType('receipt')} />
                                        <span className="ml-2">領収書</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input type="radio" name="docType" className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" checked={docType === 'invoice'} onChange={() => setDocType('invoice')} />
                                        <span className="ml-2">請求書</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">発行対象の費用</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" checked={splitType === 'combined'} onChange={() => setSplitType('combined')} />
                                        <span className="ml-2">合算</span>
                                    </label>
                                    {data.lecture_fee > 0 && (
                                        <label className="flex items-center">
                                            <input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" checked={splitType === 'lecture'} onChange={() => setSplitType('lecture')} />
                                            <span className="ml-2">受講費のみ</span>
                                        </label>
                                    )}
                                    {data.social_fee > 0 && (
                                        <label className="flex items-center">
                                            <input type="radio" name="splitType" className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" checked={splitType === 'social'} onChange={() => setSplitType('social')} />
                                            <span className="ml-2">懇親会費のみ</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        宛名 <span className="text-xs text-gray-500">（会社名などに変更可能）</span>
                                    </label>
                                    <input type="text" value={addressee} onChange={(e) => setAddressee(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border" />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">敬称</label>
                                    <select value={honorific} onChange={(e) => setHonorific(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border bg-white">
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
                                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {docType === 'receipt' ? '領収日（お支払日）' : '請求日'}
                                </label>
                                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border" />
                            </div>

                            {docType === 'receipt' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">お支払い方法</label>
                                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border bg-white">
                                        <option value="銀行振込">銀行振込</option>
                                        <option value="クレジットカード">クレジットカード</option>
                                        <option value="現金">現金</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="mt-6 p-3 bg-red-100 text-red-700 border border-red-400 rounded">{errorMsg}</div>
                    )}
                    {successMsg && (
                        <div className="mt-6 p-3 bg-green-100 text-green-700 border border-green-400 rounded">{successMsg}</div>
                    )}

                    <div className="mt-8 border-t pt-6 text-center">
                        <p className="text-sm text-gray-600 mb-4">
                            ※ 下記のボタンを押すと、印刷プレビューが開きます。<br/>
                            送信先（プリンター）を「PDFに保存」にして保存してください。
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
                    ↓ プレビュー（この枠線以下の内容が印刷されます） ↓
                </div>
            </div>

            {/* ===== 印刷用 @page スタイル ===== */}
            <style>{`
                @media print {
                    @page {
                        size: 209.97mm 296.93mm;
                        margin: 0;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print-hide { display: none !important; }
                }
            `}</style>

            {/* ===== 帳票プレビュー本体 ===== */}
            <div
                className="mx-auto bg-white sm:shadow-lg sm:border sm:border-gray-300 print:shadow-none print:border-none print:m-0 font-serif text-gray-900 box-border flex flex-col"
                style={{
                    width: '209.97mm',
                    minHeight: '296.93mm',
                    padding: '20mm 18mm 15mm 18mm',
                }}
            >
                {/* タイトル + 発行日（右揃え） */}
                <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'24px'}}>
                    <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'34px', letterSpacing:'0.65em', fontWeight:'normal', marginBottom:'10px', paddingRight:'8px', lineHeight:'1.2'}}>
                            {docType === 'receipt' ? '領　収　書' : '請　求　書'}
                        </div>
                        <div style={{display:'flex', alignItems:'baseline', justifyContent:'flex-end', gap:'10px'}}>
                            <span style={{fontSize:'11px', letterSpacing:'0.1em'}}>発行日</span>
                            <span style={{fontSize:'12px', fontFamily:'monospace', borderBottom:'1px solid #222', minWidth:'115px', textAlign:'right', paddingBottom:'1px', paddingRight:'4px'}}>{issueDate.replace(/-/g, '/')}</span>
                        </div>
                    </div>
                </div>

                {/* 宛名 */}
                <div style={{borderBottom:'1.5px solid #222', paddingBottom:'3px', marginBottom:'28px', display:'inline-flex', alignItems:'flex-end', minWidth:'60%'}}>
                    <span style={{fontSize:'22px', fontWeight:'bold', letterSpacing:'0.18em', paddingLeft:'4px'}}>{addressee}</span>
                    <span style={{fontSize:'16px', marginLeft:'16px', marginBottom:'1px', letterSpacing:'0.1em'}}>{honorific}</span>
                </div>

                {/* 金額エリア */}
                <div style={{paddingLeft:'8px', marginBottom:'8px'}}>
                    {/* 金額行 */}
                    <div style={{display:'flex', alignItems:'flex-end', gap:'14px', marginBottom:'18px'}}>
                        <span style={{fontSize:'14px', letterSpacing:'0.55em', whiteSpace:'nowrap', paddingBottom:'2px'}}>金　額</span>
                        <div style={{borderBottom:'1.5px solid #222', paddingBottom:'2px', minWidth:'250px'}}>
                            <span style={{fontSize:'26px', fontWeight:'bold', fontFamily:'monospace'}}>¥{totalAmount.toLocaleString()} -</span>
                        </div>
                        {docType === 'receipt' && (
                            <span style={{fontSize:'10px', color:'#555', paddingBottom:'2px', whiteSpace:'nowrap'}}>※お支払方法: {paymentMethod}</span>
                        )}
                    </div>

                    {/* 但し書き */}
                    <div style={{display:'flex', alignItems:'flex-start', gap:'14px', marginBottom:'22px'}}>
                        <span style={{
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            fontSize: '14px',
                            letterSpacing: '0.3em',
                            height: '2.8em',
                            flexShrink: 0,
                            lineHeight: 1.4
                        }}>但し</span>
                        <div style={{borderBottom:'1px solid #222', paddingBottom:'2px', minWidth:'280px', marginTop:'10px'}}>
                            <span style={{fontSize:'13px', letterSpacing:'0.1em'}}>{description || '　　　　　　　　　　　　　　　　　　'}</span>
                        </div>
                    </div>

                    {/* 確認文言 */}
                    <div style={{fontSize:'13px', letterSpacing:'0.2em', paddingLeft:'70px', marginTop:'8px'}}>
                        {docType === 'receipt' ? '上記正に領収いたしました。' : '上記の通りご請求申し上げます。'}
                    </div>
                </div>

                {/* スペーサー */}
                <div style={{flex:1}} />

                {/* 下部: 内訳テーブル(左) + 会社情報(右) */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:'16px'}}>
                    
                    {/* 内訳テーブル + 社印 */}
                    <div>
                        <table style={{borderCollapse:'collapse', border:'1px solid #222', fontSize:'11px', width:'200px'}}>
                            <thead>
                                <tr>
                                    <th style={{border:'1px solid #222', textAlign:'center', padding:'4px 3px', fontWeight:'normal', width:'44px', fontSize:'10px'}}>税率</th>
                                    <th style={{border:'1px solid #222', textAlign:'center', padding:'4px 5px', fontWeight:'normal', fontSize:'10px'}}>税別金額</th>
                                    <th style={{border:'1px solid #222', textAlign:'center', padding:'4px 5px', fontWeight:'normal', fontSize:'10px'}}>消費税額</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderRates.map((rate) => {
                                    const rateBase = (taxInfo[rate] && taxInfo[rate].base) || 0;
                                    const rateTax = (taxInfo[rate] && taxInfo[rate].tax) || 0;
                                    return (
                                        <tr key={rate}>
                                            <td style={{border:'1px solid #222', textAlign:'center', padding:'5px 3px', fontWeight:'bold'}}>{rate}%</td>
                                            <td style={{border:'1px solid #222', textAlign:'right', padding:'5px 5px', fontFamily:'monospace'}}>
                                                {rateBase > 0 ? `¥${rateBase.toLocaleString()}` : ''}
                                            </td>
                                            <td style={{border:'1px solid #222', textAlign:'right', padding:'5px 5px', fontFamily:'monospace'}}>
                                                {rateTax > 0 ? `¥${rateTax.toLocaleString()}` : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        
                        {/* 社印（テーブルの下） */}
                        <img 
                            src="/images/hanko.png" 
                            alt=""
                            style={{display:'block', marginTop:'8px', width:'75px', height:'75px', mixBlendMode:'multiply', opacity:0.92}}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                        />
                    </div>

                    {/* 会社情報 */}
                    <div style={{textAlign:'right', fontSize:'11px', lineHeight:'1.8', letterSpacing:'0.04em'}}>
                        <div style={{fontWeight:'bold', fontSize:'13px', marginBottom:'5px'}}>株式会社フィールドオブドリームス</div>
                        <div>〒810-0044</div>
                        <div>福岡市中央区六本松2-3-6 9F</div>
                        <div>T2290001075481</div>
                        <div>TEL: 092-791-4547</div>
                        <div>FAX: 092-791-4548</div>
                    </div>
                </div>

                {/* 請求書のみ備考 */}
                {docType === 'invoice' && (
                    <div style={{marginTop:'20px', fontSize:'10px', color:'#333', lineHeight:'1.6', borderTop:'1px solid #ccc', paddingTop:'10px'}}>
                        <div style={{fontWeight:'bold', marginBottom:'4px'}}>【備考】</div>
                        <div>・お支払いは、記載の期日までにお願いいたします。</div>
                        <div>・振込手数料は貴社にてご負担くださいますようお願い申し上げます。</div>
                    </div>
                )}
            </div>

        </div>
    );
}
