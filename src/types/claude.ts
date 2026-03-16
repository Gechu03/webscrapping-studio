export interface ClaudeCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // millisecond timestamp (matching Claude CLI format)
  scopes: string[];
  subscriptionType?: string;
}

export interface ClaudeRunnerOptions {
  workingDirectory: string;
  prompt: string;
  allowedTools?: string[];
  timeout?: number;
  maxTurns?: number;
  credentials?: ClaudeCredentials;
}

export interface ClaudeStreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  timestamp: string;
}

export interface ClaudeRunResult {
  success: boolean;
  output: string;
  filesCreated: string[];
  filesModified: string[];
  error?: string;
  duration: number;
}

export interface ClaudeProcessInfo {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  prompt: string;
  startedAt?: string;
  completedAt?: string;
  pid?: number;
}

export type ClaudeEventType =
  | 'stream'
  | 'file_created'
  | 'file_modified'
  | 'progress'
  | 'completed'
  | 'error';

export interface ClaudeEvent {
  type: ClaudeEventType;
  processId: string;
  projectId: string;
  data: unknown;
  timestamp: string;
}
