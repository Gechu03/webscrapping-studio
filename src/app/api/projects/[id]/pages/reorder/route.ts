import { NextRequest, NextResponse } from 'next/server';
import { getProject, reorderPages } from '@/lib/project-manager';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
  }

  await reorderPages(id, orderedIds);
  return NextResponse.json({ success: true });
}
