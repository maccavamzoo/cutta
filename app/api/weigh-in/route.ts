import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weight_kg, local_date } = await req.json();
  const sql = getDb();

  const rows = await sql`
    INSERT INTO weigh_ins (clerk_user_id, weight_kg, local_date)
    VALUES (${userId}, ${weight_kg}, ${local_date})
    ON CONFLICT (clerk_user_id, local_date) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      logged_at = now()
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
