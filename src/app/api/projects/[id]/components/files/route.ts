import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProject } from '@/lib/project-manager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Flat components/ directory (shared across pages)
    const componentsDir = path.join(project.path, 'components');
    if (!fs.existsSync(componentsDir)) {
      return NextResponse.json({ files: [] });
    }

    const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && /\.(html|tsx|vue)$/.test(e.name))
      .map((e) => {
        const ext = path.extname(e.name);
        const type = path.basename(e.name, ext);
        return { name: e.name, type };
      });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to list component files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
