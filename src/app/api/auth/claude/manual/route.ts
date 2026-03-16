import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveClaudeTokens } from '@/lib/user-settings';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check encryption key is configured
    if (!process.env.CLAUDE_TOKEN_SECRET) {
      return NextResponse.json(
        { error: 'Server misconfigured: CLAUDE_TOKEN_SECRET env var is not set' },
        { status: 500 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Accept raw credentials JSON (from ~/.claude/.credentials.json)
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let expiresAt: number | undefined;
    let scopes: string[] | undefined;
    let subscriptionType: string | undefined;

    if (body.claudeAiOauth) {
      const oauth = body.claudeAiOauth as Record<string, unknown>;

      // Detect format: tokens directly on claudeAiOauth vs nested under client ID
      let entry: Record<string, unknown> | undefined;

      if (oauth.accessToken) {
        // Flat format: {"claudeAiOauth": {"accessToken": "...", ...}}
        entry = oauth;
      } else {
        // Nested format: {"claudeAiOauth": {"<client_id>": {"accessToken": "...", ...}}}
        const values = Object.values(oauth);
        if (values[0] && typeof values[0] === 'object') {
          entry = values[0] as Record<string, unknown>;
        }
      }

      if (entry) {
        accessToken = entry.accessToken as string | undefined;
        refreshToken = entry.refreshToken as string | undefined;
        if (typeof entry.expiresAt === 'string') {
          expiresAt = Math.floor(new Date(entry.expiresAt).getTime() / 1000);
        } else if (typeof entry.expiresAt === 'number') {
          // Detect ms vs seconds: if > year 2100 in seconds, it's milliseconds
          expiresAt = entry.expiresAt > 4_000_000_000 ? Math.floor(entry.expiresAt / 1000) : entry.expiresAt;
        }
        scopes = entry.scopes as string[] | undefined;
        subscriptionType = entry.subscriptionType as string | undefined;
      }
    } else if (body.accessToken && body.refreshToken) {
      // Flat format without claudeAiOauth wrapper
      accessToken = body.accessToken as string;
      refreshToken = body.refreshToken as string;
      expiresAt = body.expiresAt as number | undefined;
      scopes = body.scopes as string[] | undefined;
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Could not find accessToken/refreshToken. Paste the contents of ~/.claude/.credentials.json' },
        { status: 400 }
      );
    }

    saveClaudeTokens(session.user.email, {
      accessToken,
      refreshToken,
      expiresAt: expiresAt || Math.floor(Date.now() / 1000) + 28800,
      scopes: scopes || ['user:inference', 'user:profile', 'user:sessions:claude_code', 'user:mcp_servers'],
      subscriptionType: subscriptionType || 'manual',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[claude-manual] Error saving credentials:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
