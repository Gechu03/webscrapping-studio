import { NextResponse } from 'next/server';
import { getStyles } from '@/lib/intelligence-reader';

export async function GET() {
  try {
    const styles = getStyles();
    return NextResponse.json(styles);
  } catch (error) {
    console.error('Failed to read styles:', error);
    return NextResponse.json([], { status: 500 });
  }
}
