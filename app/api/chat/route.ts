import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAgentReply } from '@/lib/groq'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  await sql`
    insert into chat_messages (owner_user_id, role, content)
    values (${userId}, 'user', ${message})
  `

  const priorRows = await sql`
    select role, content
    from chat_messages
    where owner_user_id = ${userId}
    order by created_at desc
    limit 20
  `
  const history = (priorRows as { role: 'user' | 'agent'; content: string }[])
    .reverse()
    .map((row) => ({ role: row.role === 'agent' ? ('assistant' as const) : ('user' as const), content: row.content }))

  let reply: string
  try {
    reply = await getAgentReply(history)
  } catch {
    return NextResponse.json({ error: 'Agent is temporarily unavailable' }, { status: 502 })
  }

  await sql`
    insert into chat_messages (owner_user_id, role, content)
    values (${userId}, 'agent', ${reply})
  `

  return NextResponse.json({ reply })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rows = await sql`
    select role, content, created_at
    from chat_messages
    where owner_user_id = ${userId}
    order by created_at asc
    limit 50
  `
  return NextResponse.json({ messages: rows })
}
