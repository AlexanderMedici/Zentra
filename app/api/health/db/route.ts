import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/database/mongoose'

export async function GET() {
  try {
    const conn = await connectToDatabase()
    const state = conn.connection.readyState // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    return NextResponse.json({ ok: state === 1, state })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Failed to connect to database' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
