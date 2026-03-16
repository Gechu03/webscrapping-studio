import { NextRequest, NextResponse } from 'next/server';
import { duplicatePage } from '@/lib/project-manager';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { pageId } = await params;
  const page = duplicatePage(pageId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  return NextResponse.json(page, { status: 201 });
}
