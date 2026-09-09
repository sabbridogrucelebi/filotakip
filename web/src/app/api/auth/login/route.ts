import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Backend bağlantı hatası' }, { status: 502 });
  }
}
