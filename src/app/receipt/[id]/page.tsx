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
        .in('key', ['payment_links', 'base_social_fee_tokyo', 'base_social_fee_fukuoka']);

    let paymentLinks = [];
    let baseSocialFeeTokyo = 11000;
    let baseSocialFeeFukuoka = 13000;

    if (!settingsError && settingsData) {
        const linksSetting = settingsData.find(s => s.key === 'payment_links');
        const tokyoSetting = settingsData.find(s => s.key === 'base_social_fee_tokyo');
        const fukuokaSetting = settingsData.find(s => s.key === 'base_social_fee_fukuoka');

        if (tokyoSetting && tokyoSetting.value !== undefined) baseSocialFeeTokyo = Number(tokyoSetting.value);
        if (fukuokaSetting && fukuokaSetting.value !== undefined) baseSocialFeeFukuoka = Number(fukuokaSetting.value);

        if (linksSetting?.value) {
            try {
                paymentLinks = JSON.parse(linksSetting.value);
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
    const total_amount_from_db = Number(appData.total_amount) || 0;
    let is_amount_mismatched = false;

    const matchedLink = paymentLinks.find((p: any) => p.name === targetKeyName || p.name === appData.payment_key);
    
    if (matchedLink && (Number(matchedLink.lecture_fee) > 0 || Number(matchedLink.social_fee) > 0)) {
        // マスタに内訳が正しく登録されている場合
        lecture_fee = Number(matchedLink.lecture_fee) || 0;
        social_fee = Number(matchedLink.social_fee) || 0;
        
        // マスタの合計値とDBの記録額が違う場合はアンマッチとする
        if (lecture_fee + social_fee !== total_amount_from_db) {
            is_amount_mismatched = true;
        }
    } else {
        // マスタが見つからない、または内訳が未設定(0円)の旧データの場合
        // 固定の基本懇親会費ルールで逆算する
        if (appData.social_venue === 'tokyo' || appData.social_venue === 'both') {
            social_fee = baseSocialFeeTokyo;
        } else if (appData.social_venue === 'fukuoka') {
            social_fee = baseSocialFeeFukuoka;
        } else {
            social_fee = 0;
        }

        lecture_fee = total_amount_from_db - social_fee;
        
        // マイナスになってしまうなど異常な場合はアンマッチとして総額を受講費に戻す
        if (lecture_fee < 0) {
            lecture_fee = total_amount_from_db;
            social_fee = 0;
            is_amount_mismatched = true;
        }
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
        total_amount_from_db,
        is_amount_mismatched,
        isAdmin
    };

    return <ReceiptClient data={receiptData} />;
}
