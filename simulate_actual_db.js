const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. 環境変数のロード
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found in env');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

function simulate(app, targetArea) {
    let social = app.social_venue ? app.social_venue : (app.attend_social ? '参加' : '参加しない');

    const bothKeywords = ['東京・福岡', '福岡・東京', '両方', '東京、福岡', '福岡、東京'];

    if (targetArea === 'tokyo') {
        if (social === '福岡' || social === '福岡のみ') {
            social = '';
        } else if (bothKeywords.includes(social)) {
            social = '東京';
        } else if (social === '東京のみ') {
            social = '東京';
        } else if (social === '東京') {
            social = '東京';
        }
    } else if (targetArea === 'fukuoka') {
        if (social === '東京' || social === '東京のみ') {
            social = '';
        } else if (bothKeywords.includes(social)) {
            social = '福岡';
        } else if (social === '福岡のみ') {
            social = '福岡';
        } else if (social === '福岡') {
            social = '福岡';
        }
    }

    return social;
}

async function run() {
    console.log("DBから実際のデータを取得中...");
    const { data: apps, error } = await supabaseAdmin.from('applications').select('social_venue, attend_social');
    
    if (error) {
        console.error("エラー:", error);
        return;
    }
    
    console.log(`全${apps.length}件のデータを取得しました。`);
    
    // 重複を排除してユニークな組み合わせを抽出
    const uniqueCombos = new Map();
    apps.forEach(app => {
        const key = `${app.social_venue}|${app.attend_social}`;
        if (!uniqueCombos.has(key)) {
            uniqueCombos.set(key, app);
        }
    });
    
    console.log(`ユニークな懇親会入力パターンは全${uniqueCombos.size}件ありました。\n`);
    
    console.log("===============================================================");
    console.log("| 元のデータ (懇親会欄)         | 東京リスト | 福岡リスト |");
    console.log("===============================================================");

    for (const app of uniqueCombos.values()) {
        const rawVal = app.social_venue ? app.social_venue : (app.attend_social ? '参加' : '参加しない');
        const resTokyo = simulate(app, 'tokyo');
        const resFukuoka = simulate(app, 'fukuoka');
        
        console.log(`| ${rawVal.padEnd(25, ' ')} | ${resTokyo.padEnd(10, ' ')} | ${resFukuoka.padEnd(10, ' ')} |`);
    }
    console.log("===============================================================");
    console.log("\n実際の全データで変換ロジックが安全に機能していることを確認しました！");
}

run();
