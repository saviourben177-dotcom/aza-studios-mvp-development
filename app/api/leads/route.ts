import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createLead, getLeadsForUser } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const leads = await getLeadsForUser(userId)
  return NextResponse.json({ leads })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const company = typeof body?.company === 'string' ? body.company.trim() : ''
  if (!company) {
    return NextResponse.json({ error: 'company is required' }, { status: 400 })
  }

  const score =
    typeof body?.score === 'number' && body.score >= 0 && body.score <= 100 ? Math.round(body.score) : undefined

  const lead = await createLead(userId, {
    company,
    detail: typeof body?.detail === 'string' ? body.detail.trim() || undefined : undefined,
    score,
    contactName: typeof body?.contactName === 'string' ? body.contactName.trim() || undefined : undefined,
    status: ['New', 'Qualified', 'Researching', 'Lost', 'Won'].includes(body?.status) ? body.status : undefined,
  })

  return NextResponse.json({ lead }, { status: 201 })
}
