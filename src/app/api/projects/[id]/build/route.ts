import { NextRequest } from 'next/server';
import { getProject } from '@/lib/project-manager';
import { runClaude } from '@/lib/claude-runner';
import type { ClaudeStreamChunk } from '@/types/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

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
