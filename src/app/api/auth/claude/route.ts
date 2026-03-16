import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generatePKCE, buildAuthorizationUrl } from '@/lib/claude-oauth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Build redirect URI from request origin
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/claude/callback`;

  const authUrl = buildAuthorizationUrl(redirectUri, state, codeChallenge);

  // Store PKCE verifier and state in HTTP-only cookies
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('claude_oauth_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  response.cookies.set('claude_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
