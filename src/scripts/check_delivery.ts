
const { Resend } = require('resend');

// .env.local からハードコード
const API_KEY = 're_JdZ5zPL5_NJb3w3TkQBUwuMZ29pX4ThKR';

// ユーザーから提供された最新ID
const TARGET_ID = '491e7053-0a7c-48c7-8da0-2d392370eb74';

async function checkStatus() {
    if (!API_KEY) {
        console.error('API_KEY is missing');
        return;
    }
    const resend = new Resend(API_KEY);

    try {
        console.log('Checking ID:', TARGET_ID);
        const res = await resend.emails.get(TARGET_ID);
        // 主要なフィールドを明確に出力
        console.log('TO:', JSON.stringify(res.data.to));
        console.log('FROM:', res.data.from);
        console.log('SUBJECT:', res.data.subject);
        console.log('STATUS:', res.data.last_event);
        console.log('CREATED:', res.data.created_at);

        if (res.data.last_event === 'bounced') {
            console.log('BOUNCE:', JSON.stringify(res.data, null, 2));
        }
    } catch (e) {
        console.error(`Error checking ${TARGET_ID}:`, (e as Error).message);
    }
}

checkStatus();
