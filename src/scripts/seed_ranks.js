
const { createClient } = require('@supabase/supabase-js');
// dotenv は環境依存の可能性があるため、fsでパースするかハードコードを避けるため、
// 環境変数を直接渡すか (cross-env等)、単純に .env.local を自前でパースします。
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local manually
const envPath = path.resolve(__dirname, '../../.env.local');
let envConfig = {};
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            envConfig[key] = val;
        }
    }
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    console.log('Env URL:', supabaseUrl);
    // Key is sensitive, but check if exists
    console.log('Env Key exists:', !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedRanks() {
    console.log('Seeding ranks...');

    const ranksToEnsure = [
        { name: '神言学未受講（ご紹介）', base_fee: 0, sort_order: 900 },
        { name: '神言学未受講（一般）', base_fee: 0, sort_order: 910 }
    ];

    for (const rank of ranksToEnsure) {
        // Check if exists
        const { data: existing, error: checkError } = await supabase
            .from('ranks')
            .select('*')
            .eq('name', rank.name)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error(`Error checking rank ${rank.name}:`, checkError);
            continue;
        }

        if (existing) {
            console.log(`Rank already exists: ${rank.name} (ID: ${existing.id})`);
        } else {
            console.log(`Creating rank: ${rank.name}`);
            const { data: newRank, error: createError } = await supabase
                .from('ranks')
                .insert(rank)
                .select();

            if (createError) {
                console.error(`Error creating rank ${rank.name}:`, createError);
            } else {
                console.log(`Created rank: ${rank.name} (ID: ${newRank[0].id})`);
            }
        }
    }
    console.log('Done.');
}

seedRanks();
