import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getProject } from '@/lib/project-manager';

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
  const { orders } = body as { orders: { id: string; order: number }[] };

  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: 'orders array required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const { id: componentId, order } of orders) {
      await client.query(
        'UPDATE components SET sort_order = $1, updated_at = $2 WHERE id = $3 AND project_id = $4',
        [order, now, componentId, id]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true });
}
