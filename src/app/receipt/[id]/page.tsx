import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import ReceiptClient from './ReceiptClient';

// Next.js 15 Server Component
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const { id } = await params;
    
    // 管理者フラグ
    const awaitedSearchParams = await searchParams;
    const isAdmin = awaitedSearchParams.admin === 'true';

    // データベースから情報を取得
    const { data: appData, error } = await supabaseAdmin
        .from('applications')
        .select(`
            *,
            members (
                ranks (
                    name
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error || !appData) {
        notFound();
    }

    // Settings から料金設定を取得
    const { data: settingsData, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_links')
        .single();

    let paymentLinks = [];
    if (!settingsError && settingsData?.value) {
        try {
            paymentLinks = JSON.parse(settingsData.value);
            if (!Array.isArray(paymentLinks)) {
                // オブジェクト形式から配列に変換（レガシー対応）
                paymentLinks = Object.entries(paymentLinks).map(([k, v]) => ({
                    name: k,
                    lecture_fee: 0,
                    social_fee: 0,
                    url: v
                }));
            }
        } catch (e) {
            console.error('Failed to parse payment_links settings', e);
        }
    }

    // アプリケーション情報から、該当する金額を割り出す（payment.tsのロジックを応用）
    const rankName = appData.applied_rank_name || appData.members?.ranks?.name || '一般';
    // 会場文字列の正規化
    const venueStr = appData.venue === 'both' ? '東京・福岡講演参加' : (appData.venue === 'tokyo' ? '東京講演参加' : '福岡講演参加');
    let socialStr = '懇親会なし';
    if (appData.social_venue === 'tokyo') socialStr = '懇親会東京のみ';
    if (appData.social_venue === 'fukuoka') socialStr = '懇親会福岡のみ';
    if (appData.social_venue === 'both') socialStr = '懇親会両方';

    // テンプレートを照合して金額を取得
    const targetKeyName = `【${rankName}】${venueStr}/${socialStr}`;
    let lecture_fee = 0;
    let social_fee = 0;

    const matchedLink = paymentLinks.find((p: any) => p.name === targetKeyName);
    if (matchedLink) {
        lecture_fee = Number(matchedLink.lecture_fee) || 0;
        social_fee = Number(matchedLink.social_fee) || 0;
    } else {
        // 設定が見つからない場合は、古い total_amount があればそれを受講費とする（フォールバック）
        lecture_fee = Number(appData.total_amount) || 0;
    }

    const receiptData = {
        id: appData.id,
        input_name: appData.input_name,
        venue: appData.venue,
        social_venue: appData.social_venue,
        tags: appData.tags || [],
        created_at: appData.created_at,
        applied_rank_name: rankName,
        lecture_fee,
        social_fee,
        isAdmin
    };

    return <ReceiptClient data={receiptData} />;
}
