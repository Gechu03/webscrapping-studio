import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteClaudeTokens } from '@/lib/user-settings';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  deleteClaudeTokens(session.user.email);
  return NextResponse.json({ success: true });
}
