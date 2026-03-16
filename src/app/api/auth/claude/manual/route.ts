import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveClaudeTokens } from '@/lib/user-settings';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Accept raw credentials JSON (from ~/.claude/.credentials.json)
    // Format: { "claudeAiOauth": { "<client_id>": { "accessToken": "...", "refreshToken": "...", "expiresAt": "...", "scopes": [...] } } }
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let expiresAt: number | undefined;
    let scopes: string[] | undefined;
    let subscriptionType: string | undefined;

    if (body.claudeAiOauth) {
      const oauth = body.claudeAiOauth;

      // Detect format: tokens directly on claudeAiOauth vs nested under client ID
      let entry: { accessToken?: string; refreshToken?: string; expiresAt?: string | number; scopes?: string[]; subscriptionType?: string } | undefined;

      if (oauth.accessToken) {
        // Flat format: {"claudeAiOauth": {"accessToken": "...", ...}}
        entry = oauth;
      } else {
        // Nested format: {"claudeAiOauth": {"<client_id>": {"accessToken": "...", ...}}}
        const values = Object.values(oauth) as Array<typeof entry>;
        entry = values[0];
      }

      if (entry) {
        accessToken = entry.accessToken;
        refreshToken = entry.refreshToken;
        if (typeof entry.expiresAt === 'string') {
          expiresAt = Math.floor(new Date(entry.expiresAt).getTime() / 1000);
        } else if (typeof entry.expiresAt === 'number') {
          // Detect ms vs seconds: if > year 2100 in seconds, it's milliseconds
          expiresAt = entry.expiresAt > 4_000_000_000 ? Math.floor(entry.expiresAt / 1000) : entry.expiresAt;
        }
        scopes = entry.scopes;
        subscriptionType = entry.subscriptionType;
      }
    } else if (body.accessToken && body.refreshToken) {
      // Flat format
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
      expiresAt = body.expiresAt;
      scopes = body.scopes;
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Invalid credentials format. Paste the contents of ~/.claude/.credentials.json' },
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
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON format' },
      { status: 400 }
    );
  }
}
