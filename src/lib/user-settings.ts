import { getDb } from './db';
import {
  encryptToken,
  decryptToken,
  isTokenExpired,
  type ClaudeTokens,
} from './claude-oauth';

export interface ClaudeConnectionStatus {
  connected: boolean;
  subscriptionType?: string;
  connectedAt?: string;
  expiresAt?: number;
  expired?: boolean;
}

export function getClaudeTokens(email: string): ClaudeTokens | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT claude_access_token, claude_refresh_token, claude_expires_at, claude_scopes, claude_subscription_type FROM user_settings WHERE user_email = ?'
  ).get(email) as {
    claude_access_token: string | null;
    claude_refresh_token: string | null;
    claude_expires_at: number | null;
    claude_scopes: string | null;
    claude_subscription_type: string | null;
  } | undefined;

  if (!row || !row.claude_access_token || !row.claude_refresh_token) {
    return null;
  }

  try {
    return {
      accessToken: decryptToken(row.claude_access_token),
      refreshToken: decryptToken(row.claude_refresh_token),
      expiresAt: row.claude_expires_at || 0,
      scopes: row.claude_scopes ? JSON.parse(row.claude_scopes) : [],
      subscriptionType: row.claude_subscription_type || undefined,
    };
  } catch {
    // Decryption failed — tokens are corrupted or key changed
    return null;
  }
}

export function saveClaudeTokens(email: string, tokens: ClaudeTokens): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_settings (user_email, claude_access_token, claude_refresh_token, claude_expires_at, claude_scopes, claude_subscription_type, claude_connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_email) DO UPDATE SET
      claude_access_token = excluded.claude_access_token,
      claude_refresh_token = excluded.claude_refresh_token,
      claude_expires_at = excluded.claude_expires_at,
      claude_scopes = excluded.claude_scopes,
      claude_subscription_type = excluded.claude_subscription_type,
      updated_at = datetime('now')
  `).run(
    email,
    encryptToken(tokens.accessToken),
    encryptToken(tokens.refreshToken),
    tokens.expiresAt,
    JSON.stringify(tokens.scopes),
    tokens.subscriptionType || null,
  );
}

export function deleteClaudeTokens(email: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE user_settings SET
      claude_access_token = NULL,
      claude_refresh_token = NULL,
      claude_expires_at = NULL,
      claude_scopes = NULL,
      claude_subscription_type = NULL,
      claude_connected_at = NULL,
      updated_at = datetime('now')
    WHERE user_email = ?
  `).run(email);
}

export function getConnectionStatus(email: string): ClaudeConnectionStatus {
  const db = getDb();
  const row = db.prepare(
    'SELECT claude_expires_at, claude_subscription_type, claude_connected_at, claude_access_token FROM user_settings WHERE user_email = ?'
  ).get(email) as {
    claude_expires_at: number | null;
    claude_subscription_type: string | null;
    claude_connected_at: string | null;
    claude_access_token: string | null;
  } | undefined;

  if (!row || !row.claude_access_token) {
    return { connected: false };
  }

  return {
    connected: true,
    subscriptionType: row.claude_subscription_type || undefined,
    connectedAt: row.claude_connected_at || undefined,
    expiresAt: row.claude_expires_at || undefined,
    expired: row.claude_expires_at ? isTokenExpired(row.claude_expires_at) : undefined,
  };
}
