import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

// Catch-all proxy: /api/proxy/[...path] → backend /api/[...path]
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join('/');
  const url = new URL(req.url);
  const queryString = url.search;
  
  try {
    const res = await fetch(`${BACKEND}/api/${apiPath}${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Backend bağlantı hatası' }, { status: 502 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join('/');
  
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/api/${apiPath}`, {
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join('/');
  
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${BACKEND}/api/${apiPath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Backend bağlantı hatası' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join('/');
  
  try {
    const res = await fetch(`${BACKEND}/api/${apiPath}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Backend bağlantı hatası' }, { status: 502 });
  }
}
