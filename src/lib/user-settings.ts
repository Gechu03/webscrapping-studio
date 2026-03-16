import { query } from './db';
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

export async function getClaudeTokens(email: string): Promise<ClaudeTokens | null> {
  const result = await query(
    'SELECT claude_access_token, claude_refresh_token, claude_expires_at, claude_scopes, claude_subscription_type FROM user_settings WHERE user_email = $1',
    [email]
  );

  const row = result.rows[0];
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

export async function saveClaudeTokens(email: string, tokens: ClaudeTokens): Promise<void> {
  await query(
    `INSERT INTO user_settings (user_email, claude_access_token, claude_refresh_token, claude_expires_at, claude_scopes, claude_subscription_type, claude_connected_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT(user_email) DO UPDATE SET
      claude_access_token = EXCLUDED.claude_access_token,
      claude_refresh_token = EXCLUDED.claude_refresh_token,
      claude_expires_at = EXCLUDED.claude_expires_at,
      claude_scopes = EXCLUDED.claude_scopes,
      claude_subscription_type = EXCLUDED.claude_subscription_type,
      updated_at = NOW()`,
    [
      email,
      encryptToken(tokens.accessToken),
      encryptToken(tokens.refreshToken),
      tokens.expiresAt,
      JSON.stringify(tokens.scopes),
      tokens.subscriptionType || null,
    ]
  );
}

export async function deleteClaudeTokens(email: string): Promise<void> {
  await query(
    `UPDATE user_settings SET
      claude_access_token = NULL,
      claude_refresh_token = NULL,
      claude_expires_at = NULL,
      claude_scopes = NULL,
      claude_subscription_type = NULL,
      claude_connected_at = NULL,
      updated_at = NOW()
    WHERE user_email = $1`,
    [email]
  );
}

export async function getConnectionStatus(email: string): Promise<ClaudeConnectionStatus> {
  const result = await query(
    'SELECT claude_expires_at, claude_subscription_type, claude_connected_at, claude_access_token FROM user_settings WHERE user_email = $1',
    [email]
  );

  const row = result.rows[0];
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
