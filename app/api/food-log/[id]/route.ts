import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = getDb();
  await sql`DELETE FROM food_logs WHERE id = ${params.id} AND clerk_user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
