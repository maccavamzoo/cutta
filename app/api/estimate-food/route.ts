import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { image_base64, mime_type, hint } = await req.json();
  if (!image_base64) return NextResponse.json({ error: 'image_base64 required' }, { status: 400 });

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: (mime_type || 'image/jpeg') as 'image/jpeg', data: image_base64 },
          },
          {
            type: 'text',
            text: `Estimate the calories and macros in this food photo.${hint ? ` User note: ${hint}.` : ''} Reply with only valid JSON in this exact format:
{"label":"brief food description","cals":number,"macros":{"p":number,"c":number,"f":number}}
Where p=protein grams, c=carbs grams, f=fat grams. Be concise with the label (max 40 chars). No markdown, no explanation.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]);
  return NextResponse.json(result);
}
