
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// .env.local をロード
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log('Checking admin_users table info...');

    // まともにスキーマ情報を取得できるか試す
    // RLSなどでブロックされる可能性もあるが、Service Roleならいけるはず
    // Supabase JS クライアントで直接SQLは打てないので、pgライブラリなどがなければ
    // テーブルへのInsertテストでエラーを見るのが早い

    // admin_users の存在確認
    const { data: users, error: selectError } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .limit(1);

    if (selectError) {
        console.error('Select Error:', selectError);
    } else {
        console.log('Select Result:', users);
        if (users && users.length > 0) {
            console.log('Sample user keys:', Object.keys(users[0]));
        }
    }

    // Insert Test
    console.log('Attempting to insert a test user with NULL email...');
    const testUser = {
        username: `test_user_${Date.now()}`,
        password_hash: 'dummy_hash',
        email: null, // 明示的にNULL
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
        .from('admin_users')
        .insert(testUser)
        .select();

    if (insertError) {
        console.error('Insert Error (NULL email):', insertError);
    } else {
        console.log('Insert Success (NULL email):', insertData);
        // Clean up
        await supabaseAdmin.from('admin_users').delete().eq('id', insertData[0].id);
    }
}

main().catch(console.error);
