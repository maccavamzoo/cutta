import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { activity_type, duration_min, intensity, cals, local_date } = await req.json();
  const sql = getDb();

  const rows = await sql`
    INSERT INTO activity_logs (clerk_user_id, activity_type, duration_min, intensity, cals, local_date)
    VALUES (${userId}, ${activity_type}, ${duration_min}, ${intensity}, ${cals}, ${local_date})
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
