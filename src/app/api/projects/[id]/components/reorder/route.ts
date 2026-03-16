import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProject } from '@/lib/project-manager';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const { orders } = body as { orders: { id: string; order: number }[] };

  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: 'orders array required' }, { status: 400 });
  }

  const db = getDb();
  const stmt = db.prepare('UPDATE components SET sort_order = ?, updated_at = ? WHERE id = ? AND project_id = ?');
  const now = new Date().toISOString();

  const updateMany = db.transaction(() => {
    for (const { id: componentId, order } of orders) {
      stmt.run(order, now, componentId, id);
    }
  });

  updateMany();

  return NextResponse.json({ success: true });
}
