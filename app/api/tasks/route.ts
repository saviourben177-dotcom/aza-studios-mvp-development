import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createTask, getPendingTasksForUser } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tasks = await getPendingTasksForUser(userId)
  return NextResponse.json({ tasks })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const task = await createTask(userId, {
    title,
    detail: typeof body?.detail === 'string' ? body.detail.trim() || undefined : undefined,
    actionLabel: typeof body?.actionLabel === 'string' ? body.actionLabel.trim() || undefined : undefined,
    leadId: typeof body?.leadId === 'string' ? body.leadId : undefined,
  })

  return NextResponse.json({ task }, { status: 201 })
}
