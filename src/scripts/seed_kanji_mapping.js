const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
    const envPath = path.resolve(__dirname, '../../.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;
        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

loadEnv();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KANJI_MAP = {
    '邊': '辺', '邉': '辺',
    '齋': '斎', '齊': '斎', '齎': '斎',
    '髙': '高',
    '濵': '浜', '濱': '浜',
    '澤': '沢',
    '國': '国',
    '眞': '真',
    '黑': '黒',
    '廣': '広',
    '豐': '豊',
    '壽': '寿',
    '惠': '恵',
    '禮': '礼',
    '德': '徳',
    '峯': '峰',
    '穗': '穂',
    '曾': '曽',
    '栁': '柳',
    '﨑': '崎',
    '𠮷': '吉',
    '龍': '竜',
    '淵': '渕',
    '辨': '弁',
    '鹽': '塩',
    '鐵': '鉄',
    '號': '号',
    '學': '学',
    '會': '会',
    '體': '体',
    '來': '来',
};

async function seed() {
    console.log('Seeding kanji_mapping...');
    const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'kanji_mapping', value: KANJI_MAP }, { onConflict: 'key' });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success!');
    }
}

seed();
