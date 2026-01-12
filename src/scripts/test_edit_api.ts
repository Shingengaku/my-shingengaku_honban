
import fs from 'fs';
import path from 'path';

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            process.env[key.trim()] = values.join('=').trim();
        }
    });
    console.log('Loaded .env.local');
} catch (e) {
    console.warn('Could not load .env.local', e);
}

import { supabaseAdmin } from '../lib/supabaseAdmin';

async function main() {
    console.log('--- Starting Test ---');

    // 1. Get a target application
    const { data: app, error } = await supabaseAdmin
        .from('applications')
        .select('*, members(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !app) {
        console.error('Failed to get app:', error);
        return;
    }

    console.log(`Target App ID: ${app.id}`);
    console.log(`Current CC: ${app.cc_email}`);
    console.log(`Current Member Generation: ${app.members?.generation}`);
    console.log(`Matched Member ID: ${app.matched_member_id}`);

    const targetId = app.id;
    const newCC = 'test-cc-' + Date.now() + '@example.com';
    const newGen = 999;

    // 2. Call API (simulate fetch)
    // We can't easily call localhost:3000 from here without fetch polyfill or node-fetch usually, 
    // but modern Node has global fetch.

    console.log(`Sending update request... CC=${newCC}, Gen=${newGen}`);

    const payload = {
        id: targetId,
        type: 'update',
        cc_email: newCC,
        member_generation: newGen
    };

    try {
        const res = await fetch('http://localhost:3000/api/admin/applications/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        console.log('API Response:', json);
    } catch (e) {
        console.error('API Call Failed:', e);
    }

    // 3. Verify
    console.log('--- Verifying ---');
    const { data: updatedApp } = await supabaseAdmin
        .from('applications')
        .select('*, members(*)')
        .eq('id', targetId)
        .single();

    if (updatedApp) {
        console.log(`Updated CC: ${updatedApp.cc_email}`);
        console.log(`Updated Member Generation: ${updatedApp.members?.generation}`);

        if (updatedApp.cc_email === newCC) {
            console.log('SUCCESS: CC Email updated.');
        } else {
            console.error('FAILURE: CC Email NOT updated.');
        }

        if (updatedApp.members?.generation === newGen) {
            console.log('SUCCESS: Member Generation updated.');
        } else {
            console.error('FAILURE: Member Generation NOT updated. (Note: Only works if matched_member_id exists)');
        }
    }
}

main().catch(console.error);
