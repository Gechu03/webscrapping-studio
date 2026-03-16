import crypto from 'crypto';

// Claude Code OAuth configuration (from CLI source)
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_SCOPES = 'user:inference user:profile user:sessions:claude_code user:mcp_servers';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface ClaudeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  scopes: string[];
  subscriptionType?: string;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.CLAUDE_TOKEN_SECRET;
  if (!secret) {
    throw new Error('CLAUDE_TOKEN_SECRET environment variable is required for token encryption');
  }
  // Accept 32-byte hex string (64 chars) or use SHA-256 hash of arbitrary string
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export async function refreshAccessToken(refreshToken: string): Promise<ClaudeTokens> {
  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLAUDE_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 28800),
    scopes: (data.scope || CLAUDE_SCOPES).split(' '),
    subscriptionType: data.subscription_type,
  };
}

export function isTokenExpired(expiresAt: number): boolean {
  // 5-minute buffer
  return Date.now() / 1000 >= expiresAt - 300;
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
