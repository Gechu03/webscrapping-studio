import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getConnectionStatus } from '@/lib/user-settings';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = getConnectionStatus(session.user.email);
  return NextResponse.json(status);
}
