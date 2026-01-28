import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials missing in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function simulateDashboardApi() {
    console.log(`Checking API Logic on: ${supabaseUrl}`);

    // 1. Fetch data
    const { data: rawData, error } = await supabaseAdmin
        .from('applications')
        .select(`
            *,
            members (
                terms ( name ),
                generation,
                furigana,
                ranks (
                    name,
                    base_fee,
                    sort_order
                )
            )
        `);

    if (error) {
        console.error('API Error:', error);
        return;
    }

    console.log(`Fetched ${rawData?.length} raw records.`);

    // Manual casting to bypass strict typing in script
    const data = rawData as any[];

    if (!data) return;

    // 2. Sort Logic (Replication)
    try {
        const sortedData = data.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        console.log(`Sorted ${sortedData.length} records successfully.`);

        // 3. Map Logic (Replication)
        const responseData = sortedData.map(app => {
            const rankName = app.applied_rank_name || app.members?.ranks?.name || '一般';
            const generation = parseInt(app.members?.terms?.name || app.members?.generation || '0');
            return {
                id: app.id,
                name: app.input_name,
                generation: generation
            };
        });

        console.log('Mapping successful. Sample:', responseData[0]);
    } catch (e) {
        console.error('Processing Error:', e);
    }
}

simulateDashboardApi();
