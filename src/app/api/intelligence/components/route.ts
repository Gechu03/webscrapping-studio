import { NextRequest, NextResponse } from 'next/server';
import { getComponentPatterns, getPageSections } from '@/lib/intelligence-reader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'page') {
      const sector = searchParams.get('sector') || undefined;
      const subCategory = searchParams.get('subCategory') || undefined;
      const sections = getPageSections(sector, subCategory);
      return NextResponse.json(sections);
    }

    const patterns = getComponentPatterns();
    return NextResponse.json(patterns);
  } catch (error) {
    console.error('Failed to read component patterns:', error);
    return NextResponse.json([], { status: 500 });
  }
}
