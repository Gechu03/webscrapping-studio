import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/project-manager';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const type = request.nextUrl.searchParams.get('type');
  const ext = request.nextUrl.searchParams.get('ext') || 'html';

  if (!type) {
    return NextResponse.json({ error: 'type parameter required' }, { status: 400 });
  }

  // Components are in flat components/ directory (shared across pages)
  const filePath = path.join(project.path, 'components', `${type}.${ext}`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ content: '', exists: false });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json({ content, exists: true });
}
