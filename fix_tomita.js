const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let url = '', key = '';
for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}
const supabase = createClient(url, key);

async function main() {
    // 冨田啓好桂さんのご紹介申込みを修正
    // payment_key: 講義１＋懇親会参加１（未受講_ご紹介）１ (lecture_fee: 55000 + social_fee: 11000 = 66000)
    const appId = 'f3bcbf62-677a-4caa-b7f8-e7731c71d2c6';
    const { data, error } = await supabase
        .from('applications')
        .update({
            total_amount: 66000,
            payment_key: '講義１＋懇親会参加１（未受講_ご紹介）１'
        })
        .eq('id', appId)
        .select();
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Updated:', JSON.stringify(data, null, 2));
    }
}
main();
