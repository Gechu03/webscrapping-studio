import { spawn, execFileSync, ChildProcess } from 'child_process';
import { appendFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { mkdtempSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Resolve the Claude CLI entry point (bypasses cmd.exe wrapper on Windows)
function resolveClaudeCli(): { exe: string; cliArgs: string[] } {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      // Find claude.cmd → extract the node_modules cli.js path
      const where = execFileSync('where', ['claude'], { encoding: 'utf-8', timeout: 5000 });
      const cmdPath = where.split('\n').find((l) => l.trim().endsWith('.cmd'))?.trim();
      if (cmdPath) {
        const dir = cmdPath.replace(/[/\\][^/\\]+$/, '');
        const cliJs = `${dir}/node_modules/@anthropic-ai/claude-code/cli.js`;
        return { exe: process.execPath, cliArgs: [cliJs] };
      }
    } else {
      // Linux/macOS: check if claude is on PATH
      execFileSync('which', ['claude'], { encoding: 'utf-8', timeout: 5000 });
    }
  } catch { /* fallback */ }
  // Fallback: use 'claude' directly (works on Linux/macOS where it's on PATH)
  return { exe: 'claude', cliArgs: [] };
}

const claudeCli = resolveClaudeCli();

const LOG_PATH = path.join(process.cwd(), 'data', 'claude-runner.log');

function logToFile(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, line);
  } catch { /* ignore */ }
}
import type {
  ClaudeRunnerOptions,
  ClaudeRunResult,
  ClaudeProcessInfo,
  ClaudeStreamChunk,
} from '@/types/claude';

const MAX_CONCURRENT = 2;
const activeProcesses = new Map<string, ChildProcess>();
const queue: Array<{
  id: string;
  options: ClaudeRunnerOptions;
  resolve: (result: ClaudeRunResult) => void;
  reject: (error: Error) => void;
  onStream?: (chunk: ClaudeStreamChunk) => void;
}> = [];

export function getActiveProcessCount(): number {
  return activeProcesses.size;
}

export function getProcessInfo(id: string): ClaudeProcessInfo | null {
  const proc = activeProcesses.get(id);
  if (!proc) return null;
  return {
    id,
    projectId: '',
    status: 'running',
    prompt: '',
    pid: proc.pid,
  };
}

export function killProcess(id: string): boolean {
  const proc = activeProcesses.get(id);
  if (proc) {
    proc.kill('SIGTERM');
    activeProcesses.delete(id);
    return true;
  }
  return false;
}

export async function runClaude(
  options: ClaudeRunnerOptions,
  onStream?: (chunk: ClaudeStreamChunk) => void
): Promise<ClaudeRunResult> {
  const id = uuidv4();

  logToFile(`[claude-runner] runClaude called. activeProcesses=${activeProcesses.size}, queue=${queue.length}`);

  if (activeProcesses.size >= MAX_CONCURRENT) {
    logToFile(`[claude-runner] QUEUED — max concurrent (${MAX_CONCURRENT}) reached`);
    return new Promise((resolve, reject) => {
      queue.push({ id, options, resolve, reject, onStream });
    });
  }

  return executeClaudeProcess(id, options, onStream);
}

async function executeClaudeProcess(
  id: string,
  options: ClaudeRunnerOptions,
  onStream?: (chunk: ClaudeStreamChunk) => void
): Promise<ClaudeRunResult> {
  const {
    workingDirectory,
    prompt,
    allowedTools,
    timeout = 300_000, // 5 min default
    maxTurns,
    credentials,
  } = options;

  const args = ['--print', '--dangerously-skip-permissions'];

  if (allowedTools && allowedTools.length > 0) {
    for (const tool of allowedTools) {
      args.push('--allowedTools', tool);
    }
  }

  if (maxTurns) {
    args.push('--max-turns', String(maxTurns));
  }

  const startTime = Date.now();

  // If credentials provided, create temp HOME dir with .claude/.credentials.json
  let tempHomeDir: string | null = null;
  if (credentials) {
    try {
      tempHomeDir = mkdtempSync(path.join(tmpdir(), 'claude-home-'));
      const claudeDir = path.join(tempHomeDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      // Write credentials in Claude CLI expected format (FLAT on claudeAiOauth — matches ~/.claude/.credentials.json)
      const credentialsJson = {
        claudeAiOauth: {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt, // millisecond timestamp
          scopes: credentials.scopes,
          ...(credentials.subscriptionType && { subscriptionType: credentials.subscriptionType }),
        },
      };
      const credPath = path.join(claudeDir, '.credentials.json');
      writeFileSync(credPath, JSON.stringify(credentialsJson, null, 2));

      // Also write .claude.json with oauthAccount info (CLI checks this for login status)
      const accountJson = {
        oauthAccount: {
          subscription_type: credentials.subscriptionType || 'max',
        },
      };
      writeFileSync(
        path.join(tempHomeDir, '.claude.json'),
        JSON.stringify(accountJson, null, 2)
      );

      // Write minimal settings to skip onboarding
      writeFileSync(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify({ hasCompletedOnboarding: true }, null, 2)
      );

      logToFile(`[claude-runner] Created temp HOME with credentials at ${tempHomeDir}`);
    } catch (err) {
      logToFile(`[claude-runner] Failed to create temp credentials: ${err}`);
      tempHomeDir = null;
    }
  }

  return new Promise<ClaudeRunResult>((resolve, reject) => {
    // Remove all Claude Code env vars to allow spawning Claude CLI as a subprocess
    const cleanEnv = { ...process.env };
    for (const key of Object.keys(cleanEnv)) {
      if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE')) {
        delete cleanEnv[key];
      }
    }

    // Point HOME to temp dir with credentials
    if (tempHomeDir) {
      cleanEnv.HOME = tempHomeDir;
      cleanEnv.USERPROFILE = tempHomeDir; // Windows
    }

    logToFile(`[claude-runner] Spawning claude (prompt: ${prompt.length} chars, cwd: ${workingDirectory})`);

    const proc = spawn(claudeCli.exe, [...claudeCli.cliArgs, ...args], {
      cwd: workingDirectory,
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt via stdin — goes directly to node process (no cmd.exe buffering)
    if (proc.stdin) {
      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    logToFile(`[claude-runner] Process spawned, PID: ${proc.pid}`);
    activeProcesses.set(id, proc);

    let output = '';
    let error = '';
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    let settled = false;

    const settle = (result: ClaudeRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      activeProcesses.delete(id);

      // Clean up temp credentials directory
      if (tempHomeDir) {
        try { rmSync(tempHomeDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      // Only stream error if process actually failed
      if (!result.success && result.error) {
        onStream?.({
          type: 'error',
          content: result.error,
          timestamp: new Date().toISOString(),
        });
      }

      onStream?.({
        type: 'done',
        timestamp: new Date().toISOString(),
      });

      resolve(result);
      processQueue();
    };

    const timeoutId = setTimeout(() => {
      logToFile(`[claude-runner] Process ${proc.pid} timed out after ${timeout}ms`);
      proc.kill('SIGTERM');
      settle({
        success: false,
        output,
        filesCreated,
        filesModified,
        error: `Process timed out after ${timeout}ms`,
        duration: Date.now() - startTime,
      });
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      logToFile(`[claude-runner] stdout chunk (${text.length} bytes): ${text.substring(0, 100)}`);

      // Stream plain text output directly
      if (text && !settled) {
        onStream?.({
          type: 'text',
          content: text,
          timestamp: new Date().toISOString(),
        });
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      error += chunk;
      logToFile(`[claude-runner] stderr: ${chunk.substring(0, 200)}`);
    });

    proc.on('close', (code) => {
      logToFile(`[claude-runner] Process closed with code ${code}, output length: ${output.length}`);
      settle({
        success: code === 0,
        output,
        filesCreated,
        filesModified,
        error: code !== 0 ? (error || `Process exited with code ${code}`) : (error || undefined),
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      logToFile(`[claude-runner] Process error: ${err.message}`);
      clearTimeout(timeoutId);
      if (settled) return;
      settled = true;
      activeProcesses.delete(id);

      onStream?.({
        type: 'error',
        content: `Failed to start Claude CLI: ${err.message}. Make sure 'claude' is installed and on your PATH.`,
        timestamp: new Date().toISOString(),
      });

      reject(err);
      processQueue();
    });
  });
}

function parseStreamChunk(parsed: Record<string, unknown>): ClaudeStreamChunk | null {
  // Claude CLI stream-json format (with --verbose)

  // Assistant message: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...}}
  if (parsed.type === 'assistant') {
    const message = parsed.message as Record<string, unknown> | undefined;
    if (message?.content) {
      const contentBlocks = message.content as Array<Record<string, unknown>>;
      const textParts = contentBlocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text as string)
        .join('');
      if (textParts) {
        return {
          type: 'text',
          content: textParts,
          timestamp: new Date().toISOString(),
        };
      }
    }
    return null;
  }

  // Content block delta (streaming chunks)
  if (parsed.type === 'content_block_delta') {
    const delta = parsed.delta as Record<string, unknown>;
    if (delta?.type === 'text_delta') {
      return {
        type: 'text',
        content: delta.text as string,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Tool use events
  if (parsed.type === 'tool_use') {
    return {
      type: 'tool_use',
      toolName: parsed.name as string,
      toolInput: parsed.input as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };
  }

  // Final result: {"type":"result","result":"...","subtype":"success"}
  if (parsed.type === 'result') {
    return {
      type: 'result',
      content: parsed.result as string,
      timestamp: new Date().toISOString(),
    };
  }

  // System init event — ignore
  if (parsed.type === 'system') {
    return null;
  }

  return null;
}

function processQueue() {
  while (queue.length > 0 && activeProcesses.size < MAX_CONCURRENT) {
    const next = queue.shift();
    if (next) {
      executeClaudeProcess(next.id, next.options, next.onStream)
        .then(next.resolve)
        .catch(next.reject);
    }
  }
}
