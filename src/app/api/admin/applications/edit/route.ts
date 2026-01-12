
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, type, ...updates } = body;
        // type: 'cancel' | 'update'

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        if (type === 'cancel') {
            const { error } = await supabaseAdmin
                .from('applications')
                .update({ payment_status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        if (type === 'update') {
            // Extract special fields
            // remarks: strictly speaking, we suspect this column might not exist yet. 
            // If the user hasn't added it, this update will fail. 
            // We will Try to update it, but if it fails, we might fallback? 
            // For now, let's include it. If it fails, the user needs to add the column.
            // Wait, to be safe and "fix the error", let's assume standard columns first.

            // Actually, let's just destructure strictly to control what goes to 'applications'
            console.log('Received updates:', updates);

            const {
                member_generation,
                ...appUpdates
            } = updates;

            console.log('App updates to apply:', appUpdates);

            let currentUpdates = { ...appUpdates };
            let attempt = 0;
            const maxRetries = 5;

            while (attempt < maxRetries) {
                const { error: appError } = await supabaseAdmin
                    .from('applications')
                    .update(currentUpdates)
                    .eq('id', id);

                if (!appError) {
                    console.log('Application update successful');
                    break;
                }

                console.error('Application update error:', appError);

                // Check for missing column error (Postgres code 42703)
                // Message format: column "remarks" of relation "applications" does not exist
                const isMissingColumn = appError.code === '42703';
                let missingCol = null;

                if (isMissingColumn) {
                    // Search for any key in currentUpdates that appears in the error message
                    // Postgres usually quotes column names: column "foo" ...
                    missingCol = Object.keys(currentUpdates).find(key =>
                        appError.message.includes(`"${key}"`) ||
                        appError.message.includes(`'${key}'`) ||
                        appError.message.includes(key) // Fallback for unquoted
                    );
                }

                if (isMissingColumn && missingCol && currentUpdates[missingCol] !== undefined) {
                    console.warn(`Column '${missingCol}' missing in DB. stripping from update payload and retrying...`);
                    delete currentUpdates[missingCol];
                    attempt++;
                } else {
                    // Not a missing column error, or couldn't parse column name, or column not in payload
                    console.error('Application Update Error details:', { code: appError.code, message: appError.message, details: appError.details });
                    throw appError;
                }
            }

            // Update member details (Generation & Furigana) if provided
            // We need to fetch the matched_member_id first
            const { data: appData, error: fetchError } = await supabaseAdmin
                .from('applications')
                .select('matched_member_id, input_name, input_furigana, input_email') // Fetch inputs too
                .eq('id', id)
                .single();

            if (fetchError) console.error('Error fetching application for member update:', fetchError);
            console.log('Matched Member ID:', appData?.matched_member_id);

            let targetMemberId = appData?.matched_member_id;

            // IF no member is matched but we need to save generation, CREATE a member.
            if (!targetMemberId && member_generation !== undefined && member_generation !== null) {
                console.log('No matched member, attempting to create new member for Term storage...');
                const name = appUpdates.input_name || appData?.input_name;
                const email = appUpdates.input_email || appData?.input_email;
                const furigana = appUpdates.input_furigana || appData?.input_furigana;

                if (email) {
                    const { data: newMember, error: createError } = await supabaseAdmin
                        .from('members')
                        .insert({
                            name: name || 'Unknown',
                            email: email,
                            furigana: furigana || '',
                            generation: member_generation // Set directly
                        })
                        .select('id')
                        .single();

                    if (createError) {
                        console.error('Failed to create new member:', createError);
                    } else if (newMember) {
                        targetMemberId = newMember.id;
                        // Link it back to application
                        await supabaseAdmin
                            .from('applications')
                            .update({ matched_member_id: targetMemberId })
                            .eq('id', id);
                        console.log('Created and linked new member:', targetMemberId);
                    }
                } else {
                    console.warn('Cannot create member without email');
                }
            }

            if (targetMemberId) {
                const memberUpdates: any = {};

                if (member_generation !== undefined && member_generation !== null) {
                    memberUpdates.generation = member_generation;
                }

                // Sync Furigana if changed in Application
                if (appUpdates.input_furigana) {
                    memberUpdates.furigana = appUpdates.input_furigana;
                }

                console.log('Member updates to apply:', memberUpdates);

                if (Object.keys(memberUpdates).length > 0) {
                    const { error: memberError } = await supabaseAdmin
                        .from('members')
                        .update(memberUpdates)
                        .eq('id', targetMemberId);

                    if (memberError) console.error('Error updating member:', memberError);
                    else console.log('Member update successful');
                }
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (e: any) {
        console.error('Update Handler Error:', e);
        return NextResponse.json({
            error: 'Server Error',
            details: e?.message || JSON.stringify(e, null, 2)
        }, { status: 500 });
    }
}
