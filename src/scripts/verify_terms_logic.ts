
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock fetch for local testing if server is running
async function run() {
    console.log('--- Verifying Terms API ---');
    try {
        const termsRes = await fetch('http://localhost:3000/api/terms');
        if (termsRes.ok) {
            const terms = await termsRes.json();
            console.log(`Terms fetched: ${terms.length} items`);
            console.log('Sample term:', terms[0]);
        } else {
            console.error('Failed to fetch terms:', termsRes.status);
        }
    } catch (e) {
        console.error('Error fetching terms (is server running?):', e.message);
    }

    // Apply Logic Test needs actual matching. 
    // We can't easily test Apply API without sending real data or risking side effects (emails).
    // So we will simulate the Logic using Supabase Admin directly here.

    console.log('\n--- Verifying Member Lookup Logic (Direct DB) ---');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test Case: Name "神言 太郎" (normalized "神言太郎") and Term "1期" (ID 1)
    // First, let's see if we have such a member.
    const { data: members } = await supabase.from('members').select('*').limit(1);
    if (!members || members.length === 0) {
        console.log('No members found to test.');
        return;
    }
    const target = members[0];
    console.log('Target Member:', target.name, 'Term ID:', target.term_id);

    // Simulate Lookup
    const inputName = target.name; // "神言 太郎" assumed
    const inputTermId = target.term_id;

    const { data: allMembers, error } = await supabase
        .from('members')
        .select('*, ranks(id, name)')
        .eq('term_id', inputTermId);

    if (error) {
        console.error('Lookup Error:', error);
    } else {
        const normalizedInput = inputName.replace(/\s+/g, '');
        const found = allMembers.find((m: any) => m.name.replace(/\s+/g, '') === normalizedInput);

        if (found) {
            console.log('✅ Match Found:', found.name, found.email);
        } else {
            console.error('❌ Match Failed for:', inputName);
        }
    }
}

run();
