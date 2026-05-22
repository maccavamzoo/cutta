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
  const existing = await sql`
    SELECT clerk_user_id FROM user_profiles WHERE clerk_user_id = ${userId}
  `;

  let rows;
  if (existing.length > 0) {
    rows = await sql`
      UPDATE user_profiles SET
        height_cm  = ${height_cm},
        age        = ${age},
        sex        = ${sex},
        updated_at = now()
      WHERE clerk_user_id = ${userId}
      RETURNING *
    `;
  } else {
    rows = await sql`
      INSERT INTO user_profiles (clerk_user_id, weight_kg, height_cm, age, sex, unit)
      VALUES (${userId}, ${weight_kg}, ${height_cm}, ${age}, ${sex}, ${unit ?? 'metric'})
      RETURNING *
    `;
  }
  return NextResponse.json(rows[0]);
}
