import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = getDb();
  const rows = await sql`
    SELECT * FROM user_profiles WHERE clerk_user_id = ${userId}
  `;
  if (rows.length === 0) return NextResponse.json(null);
  return NextResponse.json(rows[0]);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { weight_kg, height_cm, age, sex, unit } = body;

  const sql = getDb();
  const rows = await sql`
    INSERT INTO user_profiles (clerk_user_id, weight_kg, height_cm, age, sex, unit)
    VALUES (${userId}, ${weight_kg}, ${height_cm}, ${age}, ${sex}, ${unit ?? 'metric'})
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      weight_kg  = EXCLUDED.weight_kg,
      height_cm  = EXCLUDED.height_cm,
      age        = EXCLUDED.age,
      sex        = EXCLUDED.sex,
      unit       = EXCLUDED.unit,
      updated_at = now()
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
