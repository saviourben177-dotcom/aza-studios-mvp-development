import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getActivitiesForUser, getDashboardMetrics, getLeadsForUser, getPendingTasksForUser } from '@/lib/db'
import Dashboard from './dashboard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await currentUser()
  const displayName = user?.firstName || user?.username || 'there'
  const initials = (user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()

  const [leads, activities, tasks, metrics] = await Promise.all([
    getLeadsForUser(userId),
    getActivitiesForUser(userId),
    getPendingTasksForUser(userId),
    getDashboardMetrics(userId),
  ])

  return (
    <Dashboard
      displayName={displayName}
      initials={initials}
      leads={leads}
      activities={activities}
      tasks={tasks}
      metrics={metrics}
    />
  )
}
