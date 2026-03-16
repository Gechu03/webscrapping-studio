'use client';

import { useState, useCallback, useRef } from 'react';
import type { ClaudeStreamChunk } from '@/types/claude';

interface StreamOptions {
  timeout?: number;
}

interface UseClaudeStreamReturn {
  chunks: ClaudeStreamChunk[];
  isStreaming: boolean;
  output: string;
  error: string | null;
  startStream: (projectId: string, prompt: string, options?: StreamOptions) => Promise<void>;
  stopStream: () => void;
  clearStream: () => void;
}

export function useClaudeStream(): UseClaudeStreamReturn {
  const [chunks, setChunks] = useState<ClaudeStreamChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (projectId: string, prompt: string, options?: StreamOptions) => {
    setIsStreaming(true);
    setError(null);
    setChunks([]);
    setOutput('');

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/projects/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, timeout: options?.timeout }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const chunk = JSON.parse(data) as ClaudeStreamChunk;
              setChunks((prev) => [...prev, chunk]);
              if ((chunk.type === 'text' || chunk.type === 'result') && chunk.content) {
                setOutput((prev) => prev + chunk.content);
              }
              if (chunk.type === 'error') {
                setError(chunk.content || 'Unknown error');
              }
            } catch {
              // Non-JSON SSE data
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearStream = useCallback(() => {
    setChunks([]);
    setOutput('');
    setError(null);
  }, []);

  return { chunks, isStreaming, output, error, startStream, stopStream, clearStream };
}
