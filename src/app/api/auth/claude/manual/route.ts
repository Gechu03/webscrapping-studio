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

    if (body.claudeAiOauth) {
      // Standard credentials.json format
      const oauthEntries = Object.values(body.claudeAiOauth) as Array<{
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: string | number;
        scopes?: string[];
      }>;
      const entry = oauthEntries[0];
      if (entry) {
        accessToken = entry.accessToken;
        refreshToken = entry.refreshToken;
        expiresAt = typeof entry.expiresAt === 'string'
          ? Math.floor(new Date(entry.expiresAt).getTime() / 1000)
          : entry.expiresAt;
        scopes = entry.scopes;
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
      subscriptionType: 'manual',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON format' },
      { status: 400 }
    );
  }
}
