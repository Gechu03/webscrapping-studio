import { NextRequest, NextResponse } from 'next/server';
import { getPage, updatePage, deletePage } from '@/lib/project-manager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { pageId } = await params;
  const page = getPage(pageId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  return NextResponse.json(page);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { pageId } = await params;
  const body = await request.json();

  const success = updatePage(pageId, { name: body.name, slug: body.slug });
  if (!success) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const updated = getPage(pageId);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { pageId } = await params;
  const success = deletePage(pageId);
  if (!success) {
    return NextResponse.json(
      { error: 'Cannot delete page (not found or last page)' },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true });
}
