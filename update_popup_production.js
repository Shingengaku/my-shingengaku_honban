
const { createClient } = require('@supabase/supabase-js');

// Production Data from env_backup_production.txt
const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

const supabase = createClient(PROD_URL, PROD_KEY);

const targetText = `【神言学集中講座｜開催概要】
◎ 開催日程・会場
【東京講演会】2026年3月15日（日）　13:00–17:00
会場　：ビジョンセンター東京虎ノ門　6階 601A+B室
懇親会：17:30–19:30
会場　：ビジョンセンター東京虎ノ門　6階601C+D室

【福岡講演会】3月22日（日）13:00–17:00
会場　：JRE天神クリスタルビル 3階 A・B会議室
懇親会：17:45–19:45
会場　：レストランひらまつ 博多

■ 費用（受講料・懇親会費）※金額はすべて税込み額
【会場参加 受講料】
・法人／通常／特進(1年目)：無料
・リピート／特進(2年目〜)：8,800円
・経営幹部：11,000円
・未受講（通常）：110,000円
・未受講（紹介）：110,000円

【オンライン参加 受講料】
・LIVE視聴：法人／通常／特進(1年目)：無料
・LIVE視聴：リピート／特進(2年目〜)：6,600円
・LIVE視聴：経営幹部：8,800円
・LIVE視聴：未受講（通常）：88,000円
・LIVE視聴：未受講（紹介）：66,000円
・アーカイブ視聴：法人／通常／特進(1年目)：無料
・アーカイブ視聴：リピート／特進(2年目〜)：6,600円
・アーカイブ視聴：経営幹部：8,800円
・アーカイブ視聴：未受講（通常）：88,000円
・アーカイブ視聴：未受講（紹介）：66,000円

懇親会費：
・東京：11,000円
・福岡：13,000円


■ キャンセルポリシー（講座受講料・懇親会費ともに）
7日前＝30％
3日前＝50％
前日・当日＝100％をキャンセル料として申し受けます（返金不可）


＜問い合わせ先＞
メール：info@shingengaku.com
担当：神言学アカデミー事務局`;

async function updateText() {
    console.log("Updating application_text in Production...");

    // JSON文字列として保存する必要があるため、stringifyする
    // Supabase JS client handles object->json, but primitive string to jsonb might need explicit stringify or it fails
    // However, upsert takes an object { key, value }. 
    // If we pass value as string, does it work? 
    // Let's use JSON.stringify(targetText) to be safe as per my Plan.

    // Supabase JSクライアントがJSONシリアライズを処理するため、
    // ここで明示的にstringifyすると二重エンコード（""...""）になってしまう可能性があります。
    // 生の文字列を渡して試みます。
    const val = targetText;

    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'application_text', value: val }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating:", error);
    } else {
        console.log("Successfully updated application_text.");
    }
}

updateText();
