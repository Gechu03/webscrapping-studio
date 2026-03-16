import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exchangeCodeForTokens } from '@/lib/claude-oauth';
import { saveClaudeTokens } from '@/lib/user-settings';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth error from provider
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(
      new URL(`/settings?claude_error=${encodeURIComponent(errorDesc)}`, request.url)
    );
  }

  // Validate state
  const storedState = request.cookies.get('claude_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL('/settings?claude_error=Invalid+OAuth+state.+Please+try+again.', request.url)
    );
  }

  // Get PKCE verifier
  const codeVerifier = request.cookies.get('claude_oauth_verifier')?.value;
  if (!code || !codeVerifier) {
    return NextResponse.redirect(
      new URL('/settings?claude_error=Missing+authorization+code+or+verifier.', request.url)
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/claude/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri, codeVerifier);
    saveClaudeTokens(session.user.email, tokens);

    // Clear OAuth cookies
    const response = NextResponse.redirect(new URL('/settings?claude_connected=true', request.url));
    response.cookies.delete('claude_oauth_verifier');
    response.cookies.delete('claude_oauth_state');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    return NextResponse.redirect(
      new URL(`/settings?claude_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
