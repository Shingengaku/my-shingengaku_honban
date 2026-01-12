
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

// GET: List users
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, username, email, created_at')
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST: Create user
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password, email } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        // Hash password
        const shasum = crypto.createHash('sha256');
        shasum.update(password.trim());
        const hashedPassword = shasum.digest('hex');

        // Insert
        const { error } = await supabaseAdmin
            .from('admin_users')
            .insert({
                username: username.trim(),
                email: email ? email.trim() : null,
                password_hash: hashedPassword
            });

        if (error) {
            if (error.code === '23505') { // Unique violation
                return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// DELETE: Delete user
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Basic check: Don't allow deleting the last user? 
        // Or preventing deleting 'admin' if requested?
        // For simplicity, just delete.

        const { error } = await supabaseAdmin
            .from('admin_users')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
