import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/project-manager';
import fs from 'fs';
import path from 'path';

const REPORT_FILES: Record<string, string> = {
  analysis: 'ANALYSIS_REPORT.md',
  design: 'DESIGN_SPEC.md',
  ux: 'UX_SPEC.md',
  seo: 'SEO_SPEC.md',
  build: 'BUILD_PLAN.md',
  qa: 'QA_SUMMARY.md',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const type = request.nextUrl.searchParams.get('type');

  if (type && REPORT_FILES[type]) {
    // Return a single report
    const filePath = path.join(project.path, REPORT_FILES[type]);
    const content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf-8')
      : '';
    return NextResponse.json({ type, content, exists: !!content });
  }

  // Return all reports
  const reports: Record<string, { content: string; exists: boolean }> = {};
  for (const [key, filename] of Object.entries(REPORT_FILES)) {
    const filePath = path.join(project.path, filename);
    const exists = fs.existsSync(filePath);
    reports[key] = {
      content: exists ? fs.readFileSync(filePath, 'utf-8') : '',
      exists,
    };
  }

  return NextResponse.json(reports);
}
