import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProject } from '@/lib/project-manager';
import { runClaude } from '@/lib/claude-runner';
import { buildAnalysisPrompt } from '@/lib/prompt-builder';
import { getClaudeTokens, saveClaudeTokens } from '@/lib/user-settings';
import { isTokenExpired, refreshAccessToken } from '@/lib/claude-oauth';
import type { ClaudeCredentials } from '@/types/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const project = await getProject(id);
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

  // Look up user's Claude tokens
  let tokens = await getClaudeTokens(session.user.email);
  if (!tokens) {
    return NextResponse.json(
      { error: 'Claude Code account not connected. Go to Settings to connect your account.', code: 'CLAUDE_NOT_CONNECTED' },
      { status: 403 }
    );
  }

  if (isTokenExpired(tokens.expiresAt)) {
    try {
      tokens = await refreshAccessToken(tokens.refreshToken);
      await saveClaudeTokens(session.user.email, tokens);
    } catch {
      return NextResponse.json(
        { error: 'Claude Code token expired and refresh failed. Please reconnect in Settings.', code: 'CLAUDE_TOKEN_EXPIRED' },
        { status: 403 }
      );
    }
  }

  const credentials: ClaudeCredentials = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt * 1000, // seconds → milliseconds
    scopes: tokens.scopes,
    subscriptionType: tokens.subscriptionType,
  };

  const prompt = buildAnalysisPrompt(url, competitors, phases, project.config.sector);

  try {
    const result = await runClaude({
      workingDirectory: project.path,
      prompt,
      timeout: 3_600_000, // 60 min for full analysis
      credentials,
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
