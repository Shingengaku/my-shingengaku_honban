import { NextResponse } from 'next/server';
import { KANJI_MAP } from '@/lib/kanjiNormalize';

export async function GET() {
    return NextResponse.json(KANJI_MAP);
}
