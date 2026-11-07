import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables.')
}

// Tagged-template SQL client. Use as: sql`select * from leads where id = ${id}`
export const sql = neon(process.env.DATABASE_URL)

export type Lead = {
  id: string
  company: string
  detail: string | null
  score: number | null
  contact_name: string | null
  status: 'New' | 'Qualified' | 'Researching' | 'Lost' | 'Won'
  created_at: string
}

export type Activity = {
  id: string
  title: string
  detail: string | null
  icon: string | null
  created_at: string
}

export type Task = {
  id: string
  title: string
  detail: string | null
  action_label: string
  status: 'pending' | 'approved' | 'dismissed'
  created_at: string
}

export async function getLeadsForUser(userId: string): Promise<Lead[]> {
  const rows = await sql`
    select id, company, detail, score, contact_name, status, created_at
    from leads
    where owner_user_id = ${userId}
    order by score desc nulls last, created_at desc
  `
  return rows as Lead[]
}

export async function getActivitiesForUser(userId: string, limit = 6): Promise<Activity[]> {
  const rows = await sql`
    select id, title, detail, icon, created_at
    from activities
    where owner_user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `
  return rows as Activity[]
}

export async function getPendingTasksForUser(userId: string): Promise<Task[]> {
  const rows = await sql`
    select id, title, detail, action_label, status, created_at
    from tasks
    where owner_user_id = ${userId} and status = 'pending'
    order by created_at desc
  `
  return rows as Task[]
}

export async function getDashboardMetrics(userId: string) {
  const [pipeline] = await sql`
    select
      coalesce(sum(case when status not in ('Lost') then score else 0 end), 0)::int as pipeline_score_sum,
      count(*) filter (where status = 'Qualified')::int as qualified_count,
      count(*) filter (where status in ('New','Qualified','Researching'))::int as active_count
    from leads
    where owner_user_id = ${userId}
  `
  const [tasksDone] = await sql`
    select count(*)::int as completed_count
    from tasks
    where owner_user_id = ${userId} and status = 'approved'
  `
  return {
    qualifiedLeads: pipeline?.qualified_count ?? 0,
    activeOpportunities: pipeline?.active_count ?? 0,
    tasksCompleted: tasksDone?.completed_count ?? 0,
  }
}
