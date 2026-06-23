import { NextResponse } from 'next/server';

// Must match SESSION_VALUE in middleware.ts
const SESSION_VALUE = 'sv_majidsteel_2024';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const validEmail    = process.env.AUTH_EMAIL    ?? 'majid@admin.com';
  const validPassword = process.env.AUTH_PASSWORD ?? 'majid123';

  if (email !== validEmail || password !== validPassword) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sv_session', SESSION_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
