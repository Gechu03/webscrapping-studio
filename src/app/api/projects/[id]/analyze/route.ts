import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/project-manager';
import { runClaude } from '@/lib/claude-runner';
import { buildAnalysisPrompt } from '@/lib/prompt-builder';

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
  const { competitors = [], phases = [0, 1, 2, 3, 4, 5, 6] } = body;
  const url = project.config.url;

  if (!url) {
    return NextResponse.json(
      { error: 'Project has no reference URL' },
      { status: 400 }
    );
  }

  const prompt = buildAnalysisPrompt(url, competitors, phases, project.config.sector);

  try {
    const result = await runClaude({
      workingDirectory: project.path,
      prompt,
      timeout: 3_600_000, // 60 min for full analysis
    });

    return NextResponse.json({
      success: result.success,
      filesCreated: result.filesCreated,
      filesModified: result.filesModified,
      duration: result.duration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
