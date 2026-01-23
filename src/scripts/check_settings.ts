
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function checkSettings() {
    console.log('app_settingsを確認中...');
    const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('設定が見つかりました:');
    data.forEach(row => {
        if (row.key === 'payment_links') {
            console.log(`${row.key}: [複雑なオブジェクト] (長さ: ${row.value?.length})`);
        } else {
            console.log(`${row.key}: ${JSON.stringify(row.value)}`);
        }
    });
}

checkSettings();
