import { NextResponse } from 'next/server';
import { getTypographyPairings } from '@/lib/intelligence-reader';

export async function GET() {
  try {
    const pairings = getTypographyPairings();
    return NextResponse.json(pairings);
  } catch (error) {
    console.error('Failed to read typography pairings:', error);
    return NextResponse.json([], { status: 500 });
  }
}
