import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getProject } from '@/lib/project-manager';
import { runClaude } from '@/lib/claude-runner';
import { getClaudeTokens, saveClaudeTokens } from '@/lib/user-settings';
import { isTokenExpired, refreshAccessToken } from '@/lib/claude-oauth';
import type { ClaudeStreamChunk, ClaudeCredentials } from '@/types/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth gate: require logged-in user with Claude tokens
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const project = await getProject(id);
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const prompt = body.prompt as string;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up user's Claude tokens
  let tokens = await getClaudeTokens(session.user.email);
  if (!tokens) {
    return new Response(
      JSON.stringify({
        error: 'Claude Code account not connected. Go to Settings to connect your account.',
        code: 'CLAUDE_NOT_CONNECTED',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Refresh if expired
  if (isTokenExpired(tokens.expiresAt)) {
    try {
      tokens = await refreshAccessToken(tokens.refreshToken);
      await saveClaudeTokens(session.user.email, tokens);
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Claude Code token expired and refresh failed. Please reconnect in Settings.',
          code: 'CLAUDE_TOKEN_EXPIRED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Build credentials object for Claude CLI (expiresAt in ms, matching CLI format)
  const credentials: ClaudeCredentials = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt * 1000, // seconds → milliseconds
    scopes: tokens.scopes,
    subscriptionType: tokens.subscriptionType,
  };

  // Use Server-Sent Events for streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch { /* controller already closed */ }
        }
      };
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      try {
        await runClaude(
          {
            workingDirectory: project.path,
            prompt,
            timeout: body.timeout || 300_000,
            credentials,
          },
          (chunk: ClaudeStreamChunk) => {
            safeEnqueue(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        );

        safeEnqueue('data: [DONE]\n\n');
        safeClose();
      } catch (error) {
        const errorChunk: ClaudeStreamChunk = {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        safeEnqueue(`data: ${JSON.stringify(errorChunk)}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
