require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://odxnczxbtltccfrizvkb.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // まず現在のテンプレートを取得して確認
    const { data: current } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
            'email_template_reminder_venue_paid',
            'email_template_reminder_venue_unpaid',
            'email_template_reminder_online_paid',
            'email_template_reminder_online_unpaid'
        ]);

    console.log('=== 現在のDB上のテンプレート ===');
    for (const row of (current || [])) {
        console.log(`\nKey: ${row.key}`);
        if (row.value?.body) {
            // 日時の行を確認
            const lines = row.value.body.split('\n');
            const dateLine = lines.findIndex(l => l.includes('日時'));
            if (dateLine >= 0) {
                console.log(`  日時の行(${dateLine}): "${lines[dateLine]}"`);
                if (dateLine + 1 < lines.length) {
                    console.log(`  次の行(${dateLine+1}): "${lines[dateLine+1]}"`);
                }
            }
        }
    }

    // テンプレートを更新: 「日時：{{lecture_date}}」→「日時：\n{{lecture_date}}」
    for (const row of (current || [])) {
        if (!row.value?.body) continue;

        let newBody = row.value.body;
        let newSubject = row.value.subject;
        let changed = false;

        // 「日時：{{lecture_date}}」を「日時：\n{{lecture_date}}」に修正
        if (newBody.includes('日時：{{lecture_date}}')) {
            newBody = newBody.replace('日時：{{lecture_date}}', '日時：\n{{lecture_date}}');
            changed = true;
            console.log(`\n[修正] ${row.key}: 日時の改行を修正`);
        }

        // 未決済テンプレートに「※本状と行き違いで...」を追加
        if (row.key.includes('unpaid') && !newBody.includes('※本状と行き違い')) {
            newBody = newBody.replace(
                '{{payment_link_section}}\n\n当日お会いできること',
                '{{payment_link_section}}\n\n※本状と行き違いでご入金いただいた場合は、何卒ご容赦ください。\n\n当日お会いできること'
            );
            changed = true;
            console.log(`[修正] ${row.key}: 行き違い注記を追加`);
        }

        if (changed) {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: row.key, value: { subject: newSubject, body: newBody } }, { onConflict: 'key' });
            if (error) {
                console.error(`  エラー: ${error.message}`);
            } else {
                console.log(`  ✅ 更新完了`);
            }
        }
    }

    // 更新後の確認
    const { data: updated } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
            'email_template_reminder_venue_paid',
            'email_template_reminder_venue_unpaid',
            'email_template_reminder_online_paid',
            'email_template_reminder_online_unpaid'
        ]);

    console.log('\n=== 更新後のテンプレート確認 ===');
    for (const row of (updated || [])) {
        console.log(`\nKey: ${row.key}`);
        if (row.value?.body) {
            const lines = row.value.body.split('\n');
            const dateLine = lines.findIndex(l => l.includes('日時'));
            if (dateLine >= 0) {
                console.log(`  日時の行(${dateLine}): "${lines[dateLine]}"`);
                if (dateLine + 1 < lines.length) {
                    console.log(`  次の行(${dateLine+1}): "${lines[dateLine+1]}"`);
                }
            }
            if (row.key.includes('unpaid')) {
                const hasNote = row.value.body.includes('※本状と行き違い');
                console.log(`  行き違い注記: ${hasNote ? '✅あり' : '❌なし'}`);
            }
        }
    }
}

main().catch(console.error);
