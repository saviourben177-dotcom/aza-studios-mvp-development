import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { setTaskStatus } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = body?.status

  if (status !== 'approved' && status !== 'dismissed') {
    return NextResponse.json({ error: "status must be 'approved' or 'dismissed'" }, { status: 400 })
  }

  const task = await setTaskStatus(userId, id, status)
  if (!task) {
    return NextResponse.json({ error: 'Task not found or already resolved' }, { status: 404 })
  }

  return NextResponse.json({ task })
}
