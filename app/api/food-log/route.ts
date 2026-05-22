import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { label, cals, protein_g, carbs_g, fat_g, local_date } = await req.json();
  const sql = getDb();

  const rows = await sql`
    INSERT INTO food_logs (clerk_user_id, label, cals, protein_g, carbs_g, fat_g, local_date)
    VALUES (${userId}, ${label}, ${cals}, ${protein_g}, ${carbs_g}, ${fat_g}, ${local_date})
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
