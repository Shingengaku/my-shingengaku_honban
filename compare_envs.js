
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Production (ターゲット)
const PROD_URL = "https://odxnczxbtltccfrizvkb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keG5jenhidGx0Y2Nmcml6dmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwNjE4NywiZXhwIjoyMDgzNzgyMTg3fQ.OsJMZcayGa3i8q9JTffAfwOzz2sSJlHQPW2tcGNYQnM";

// Test (ソース) - Local .env.local
const TEST_URL = "https://denudyfitlmigrbxszad.supabase.co";
const TEST_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbnVkeWZpdGxtaWdyYnhzemFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNDAxOCwiZXhwIjoyMDgzNjAwMDE4fQ.cotF_fp5eVxyscq6-ZbF0Tr12q3mN3P0r5cJBgLVP5M";

const prodClient = createClient(PROD_URL, PROD_KEY);
const testClient = createClient(TEST_URL, TEST_KEY);

async function checkAndApply() {
    console.log("Checking schemas...");

    // 1. 本番環境に online_options が存在するか確認
    const { error: err1 } = await prodClient.from('online_options').select('count', { count: 'exact', head: true });
    if (err1 && err1.code === '42P01') {
        console.log("[MISSING] 本番環境に online_options テーブルがありません。");
    } else {
        console.log("[OK] 本番環境に online_options テーブルが存在します。");
    }

    // 2. applications テーブルのカラムを確認
    console.log("Checking applications table columns (PROD)...");
    const { error: err2 } = await prodClient.from('applications').select('participation_type, attend_social, social_venue, online_venues').limit(1);
    if (err2) {
        console.log("[MISSING] PROD: applications の一部のカラムがありません:", err2.message);
    } else {
        console.log("[OK] PROD: participation_type, attend_social, social_venue, online_venues カラムが存在します。");
    }

    console.log("Checking applications table columns (TEST)...");
    const { error: err3 } = await testClient.from('applications').select('participation_type, attend_social, social_venue, online_venues').limit(1);
    if (err3) {
        console.log("[MISSING] TEST: applications の一部のカラムがありません:", err3.message);
    } else {
        console.log("[OK] TEST: participation_type, attend_social, social_venue, online_venues カラムが存在します。");
    }

    // 3. アプリ設定の構造を確認 (通常JSONBなのでスキーマ構造の確認は難しいが、キーが存在するか確認する)
    // app_settings は Key-Value なので、キーが存在するか確認します
    const { data: settings } = await prodClient.from('app_settings').select('key');
    const keys = settings ? settings.map(s => s.key) : [];
    console.log("Prod App Settings Keys:", keys);

    const expectedKeys = ['email_template', 'email_template_general', 'payment_links', 'product_name_master'];
    const missingKeys = expectedKeys.filter(k => !keys.includes(k));
    if (missingKeys.length > 0) {
        console.log("[WARN] 本番環境の設定キーが見つかりません:", missingKeys);
    } else {
        console.log("[OK] 必須の app_settings キーが存在します。");
    }

}

checkAndApply();
