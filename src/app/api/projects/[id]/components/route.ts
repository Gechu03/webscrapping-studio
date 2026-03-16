import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getProject, linkComponentToPage } from '@/lib/project-manager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(project.components);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, type, code = '', pageId } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: 'Name and type are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const componentId = uuidv4();
  const now = new Date().toISOString();

  // Check if component with this type already exists for this project (shared)
  const existing = db.prepare(
    'SELECT id FROM components WHERE project_id = ? AND type = ?'
  ).get(id, type) as { id: string } | undefined;

  if (existing) {
    // Component already exists — just link to this page
    if (pageId) {
      linkComponentToPage(pageId, existing.id, 0);
    }
    return NextResponse.json(
      { id: existing.id, name, type, version: 1, status: 'draft' },
      { status: 200 }
    );
  }

  // Get next sort order
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM components WHERE project_id = ?')
    .get(id) as { next_order: number };

  db.prepare(
    `INSERT INTO components (id, project_id, name, type, current_version, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?)`
  ).run(componentId, id, name, type, maxOrder.next_order, now, now);

  // Create initial version
  db.prepare(
    `INSERT INTO component_versions (component_id, version, code, created_at)
     VALUES (?, 1, ?, ?)`
  ).run(componentId, code, now);

  // Link to page if provided
  if (pageId) {
    linkComponentToPage(pageId, componentId, maxOrder.next_order);
  }

  return NextResponse.json(
    { id: componentId, name, type, version: 1, status: 'draft' },
    { status: 201 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const componentId = request.nextUrl.searchParams.get('componentId');
  if (!componentId) {
    return NextResponse.json({ error: 'componentId parameter required' }, { status: 400 });
  }

  const db = getDb();

  const comp = db.prepare('SELECT type FROM components WHERE id = ? AND project_id = ?').get(componentId, id) as { type: string } | undefined;
  if (!comp) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 });
  }

  // Delete join table entries, versions, and component
  db.prepare('DELETE FROM page_components WHERE component_id = ?').run(componentId);
  db.prepare('DELETE FROM component_versions WHERE component_id = ?').run(componentId);
  db.prepare('DELETE FROM components WHERE id = ?').run(componentId);

  // Delete file from flat components/ directory
  const extensions = ['html', 'tsx', 'vue'];
  for (const ext of extensions) {
    const filePath = path.join(project.path, 'components', `${comp.type}.${ext}`);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ success: true });
}
