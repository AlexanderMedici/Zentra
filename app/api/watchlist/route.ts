import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const symbol = String(body?.symbol || '').trim().toUpperCase();
    const company = String(body?.company || symbol).trim();
    if (!symbol) return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });

    await connectToDatabase();
    const userId = session.user.id || '';
    if (!userId) return NextResponse.json({ error: 'User ID missing' }, { status: 400 });

    await Watchlist.updateOne(
      { userId, symbol },
      { $setOnInsert: { userId, symbol, company, addedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Watchlist POST error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const symbol = String(searchParams.get('symbol') || '').trim().toUpperCase();
    if (!symbol) return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });

    await connectToDatabase();
    const userId = session.user.id || '';
    if (!userId) return NextResponse.json({ error: 'User ID missing' }, { status: 400 });

    await Watchlist.deleteOne({ userId, symbol });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Watchlist DELETE error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

