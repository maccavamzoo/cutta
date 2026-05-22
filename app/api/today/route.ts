import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const sql = getDb();
  const [weighIns, foodLogs, activityLogs] = await Promise.all([
    sql`SELECT * FROM weigh_ins WHERE clerk_user_id = ${userId} AND local_date = ${date} LIMIT 1`,
    sql`SELECT * FROM food_logs WHERE clerk_user_id = ${userId} AND local_date = ${date} ORDER BY logged_at ASC`,
    sql`SELECT * FROM activity_logs WHERE clerk_user_id = ${userId} AND local_date = ${date} ORDER BY logged_at ASC`,
  ]);

  let lastWeighIn = null;
  if (weighIns.length === 0) {
    const prev = await sql`
      SELECT * FROM weigh_ins WHERE clerk_user_id = ${userId} AND local_date < ${date}
      ORDER BY local_date DESC LIMIT 1
    `;
    if (prev.length > 0) lastWeighIn = prev[0];
  }

  return NextResponse.json({
    weighIn: weighIns[0] ?? null,
    lastWeighIn,
    foodLogs,
    activityLogs,
  });
}
