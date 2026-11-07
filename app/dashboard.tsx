'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  FileText,
  Filter,
  LayoutDashboard,
  ListTodo,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { Activity as ActivityRow, Lead, Task } from '@/lib/db'

type NavItem = { label: string; icon: typeof LayoutDashboard }

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'AI Employee', icon: Bot },
  { label: 'Leads', icon: Target },
  { label: 'Intelligence', icon: BrainCircuit },
  { label: 'CRM', icon: Building2 },
  { label: 'Tasks & approvals', icon: ListTodo },
  { label: 'Activity', icon: Activity },
]

const leadColors: Record<string, string> = {
  New: 'bg-cyan-400',
  Qualified: 'bg-violet-400',
  Researching: 'bg-amber-400',
  Won: 'bg-emerald-400',
  Lost: 'bg-slate-400',
}

const activityIcons: Record<string, typeof Search> = {
  search: Search,
  mail: Mail,
  brain: BrainCircuit,
}

type ChatMessage = { from: 'user' | 'agent'; text: string }

export default function Dashboard({
  displayName,
  initials,
  leads: initialLeads,
  activities,
  tasks: initialTasks,
  metrics,
}: {
  displayName: string
  initials: string
  leads: Lead[]
  activities: ActivityRow[]
  tasks: Task[]
  metrics: { qualifiedLeads: number; activeOpportunities: number; tasksCompleted: number }
}) {
  const [active, setActive] = useState('Overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [leadFilter, setLeadFilter] = useState('All leads')
  const [today, setToday] = useState('')
  const [leads, setLeads] = useState(initialLeads)
  const [tasks, setTasks] = useState(initialTasks)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [leadForm, setLeadForm] = useState({ company: '', detail: '', contactName: '', score: '' })
  const [taskForm, setTaskForm] = useState({ title: '', detail: '', actionLabel: 'Review' })
  const [savingLead, setSavingLead] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null)

  async function submitLead() {
    if (!leadForm.company.trim() || savingLead) return
    setSavingLead(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: leadForm.company.trim(),
          detail: leadForm.detail.trim() || undefined,
          contactName: leadForm.contactName.trim() || undefined,
          score: leadForm.score ? Number(leadForm.score) : undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLeads((current) => [data.lead, ...current])
        setLeadForm({ company: '', detail: '', contactName: '', score: '' })
        setShowLeadModal(false)
      }
    } finally {
      setSavingLead(false)
    }
  }

  async function submitTask() {
    if (!taskForm.title.trim() || savingTask) return
    setSavingTask(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          detail: taskForm.detail.trim() || undefined,
          actionLabel: taskForm.actionLabel.trim() || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks((current) => [data.task, ...current])
        setTaskForm({ title: '', detail: '', actionLabel: 'Review' })
        setShowTaskModal(false)
      }
    } finally {
      setSavingTask(false)
    }
  }

  async function resolveTask(taskId: string, status: 'approved' | 'dismissed') {
    setResolvingTaskId(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setTasks((current) => current.filter((task) => task.id !== taskId))
      }
    } finally {
      setResolvingTaskId(null)
    }
  }

  useEffect(() => {
    setToday(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
  }, [])

  useEffect(() => {
    fetch('/api/chat')
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages?: { role: 'user' | 'agent'; content: string }[] }) => {
        if (data.messages?.length) {
          setMessages(data.messages.map((m) => ({ from: m.role, text: m.content })))
        }
      })
      .catch(() => {})
  }, [])

  const filteredLeads = useMemo(
    () => (leadFilter === 'All leads' ? leads : leads.filter((lead) => lead.status === leadFilter)),
    [leadFilter, leads],
  )

  async function submitMessage() {
    const trimmed = message.trim()
    if (!trimmed || sending) return
    setMessages((current) => [...current, { from: 'user', text: trimmed }])
    setMessage('')
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((current) => [...current, { from: 'agent', text: data.reply }])
        // Aza may have added a lead via tool-calling — refresh the pipeline to show it.
        fetch('/api/leads')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.leads && setLeads(d.leads))
          .catch(() => {})
      } else {
        setMessages((current) => [...current, { from: 'agent', text: data.error || 'Something went wrong.' }])
      }
    } catch {
      setMessages((current) => [...current, { from: 'agent', text: 'Network error — try again.' }])
    } finally {
      setSending(false)
    }
  }

  const pipelineValue = useMemo(
    () => leads.reduce((sum, l) => sum + (l.status !== 'Lost' ? l.score ?? 0 : 0), 0),
    [leads],
  )

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-[#09162f] selection:bg-emerald-200">
      <div className="flex min-h-screen">
        <aside
          className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-slate-200 bg-[#073d34] p-4 transition-transform lg:static lg:translate-x-0`}
        >
          <div className="flex items-center justify-between px-2 pb-7 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-[10px] bg-cyan-400 text-[#061016] shadow-[0_0_24px_rgba(34,211,238,.28)]">
                <Sparkles size={17} strokeWidth={2.5} />
              </div>
              <span className="text-[17px] font-semibold tracking-[-0.03em]">
                aza<span className="text-cyan-300">.</span>
              </span>
            </div>
            <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="text-slate-500 lg:hidden">
              <X size={18} />
            </button>
          </div>
          <div className="mb-5 rounded-xl border border-slate-200 bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</span>
              <ChevronDown size={14} className="text-slate-500" />
            </div>
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-violet-500 text-[10px] font-bold text-slate-950">
                AS
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Aza Studios</p>
                <p className="text-[10px] text-slate-500">Growth team</p>
              </div>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => {
                  setActive(label)
                  setMobileOpen(false)
                }}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] transition ${active === label ? 'bg-cyan-400/10 text-cyan-200 shadow-[inset_2px_0_0_#22d3ee]' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-700'}`}
              >
                <Icon size={16} strokeWidth={active === label ? 2.2 : 1.7} />
                <span>{label}</span>
                {label === 'Tasks & approvals' && tasks.length > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                    {tasks.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-1">
            <div className="mb-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-cyan-300" />
                <span className="text-[11px] font-medium text-cyan-100">Guardrails active</span>
              </div>
              <p className="text-[10px] leading-4 text-slate-500">Read &amp; prepare mode. Actions require your approval.</p>
              <button className="mt-3 text-[10px] font-medium text-cyan-300 hover:text-cyan-200">Manage permissions →</button>
            </div>
            <button className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-slate-500 hover:bg-white/[0.04] hover:text-slate-700">
              <Settings2 size={16} />
              Settings
            </button>
            <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] px-2 pt-4">
              <div className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-orange-500 text-[10px] font-bold text-slate-900">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-700">{displayName}</p>
                <p className="truncate text-[10px] text-slate-600">Owner</p>
              </div>
              <MoreHorizontal size={15} className="ml-auto text-slate-600" />
            </div>
          </div>
        </aside>
        {mobileOpen && (
          <button aria-label="Close menu overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />
        )}

        <section className="min-w-0 flex-1">
          <header className="flex h-[68px] items-center justify-between border-b border-slate-200 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="text-slate-400 lg:hidden">
                <Menu size={20} />
              </button>
              <div>
                <p className="text-[11px] text-slate-500">{today}</p>
                <h1 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em]">
                  {active === 'Overview' ? `Good to see you, ${displayName}.` : active}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400 transition hover:border-white/20 hover:text-slate-700 sm:flex">
                <Command size={13} />⌘ K
              </button>
              <button className="relative grid size-8 place-items-center rounded-lg border border-white/[0.09] text-slate-400 hover:text-slate-700">
                <Activity size={15} />
              </button>
              <button className="grid size-8 place-items-center rounded-lg border border-white/[0.09] text-slate-400 hover:text-slate-700">
                <Plus size={16} />
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-[1380px] p-5 sm:p-8">
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-300">AI employee online</span>
                </div>
                <h2 className="text-[26px] font-semibold tracking-[-0.045em] text-[#09162f] sm:text-[30px]">Your business, in motion.</h2>
                <p className="mt-1 text-[13px] text-slate-500">Aza is working across your pipeline while you focus on the next move.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeadModal(true)}
                  className="flex w-fit items-center gap-2 rounded-lg border border-white/[0.09] px-3.5 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  <Plus size={14} /> Add lead
                </button>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex w-fit items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-2.5 text-[11px] font-semibold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,.16)] transition hover:bg-cyan-300"
                >
                  <Plus size={14} /> Assign a task
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Pipeline score" value={String(pipelineValue)} change={leads.length ? `${leads.length} leads` : 'No leads yet'} icon={CircleDollarSign} />
              <Metric label="Qualified leads" value={String(metrics.qualifiedLeads)} change="" icon={Target} />
              <Metric label="Active opportunities" value={String(metrics.activeOpportunities)} change="" icon={TrendingUp} />
              <Metric label="Tasks completed" value={String(metrics.tasksCompleted)} change="" icon={Check} />
            </div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#09162f]">AI employee</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Ask Aza to research, plan, or take action</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </div>
                </div>
                <div className="flex min-h-[300px] flex-col justify-between p-5">
                  <div className="flex flex-col gap-4">
                    {messages.length === 0 && (
                      <p className="text-[11px] text-slate-400">No messages yet — ask Aza something to get started.</p>
                    )}
                    {messages.map((item, index) => (
                      <div key={`${item.text}-${index}`} className={`flex gap-3 ${item.from === 'user' ? 'justify-end' : ''}`}>
                        <div
                          className={`max-w-[78%] rounded-xl px-3.5 py-3 text-[12px] leading-5 ${item.from === 'user' ? 'bg-cyan-400/10 text-cyan-100' : 'border border-slate-200 bg-white/[0.025] text-slate-700'}`}
                        >
                          {item.from === 'agent' && (
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-cyan-300">
                              <Bot size={12} /> Aza
                            </div>
                          )}
                          {item.text}
                        </div>
                      </div>
                    ))}
                    {sending && <p className="text-[10px] text-slate-400">Aza is thinking…</p>}
                  </div>
                  <div className="mt-6 rounded-xl border border-white/[0.09] bg-white p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) submitMessage()
                        }}
                        placeholder="Ask Aza to find, research, or plan…"
                        className="min-w-0 flex-1 bg-transparent px-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-600"
                      />
                      <button
                        aria-label="Send message"
                        onClick={submitMessage}
                        disabled={sending}
                        className="grid size-8 place-items-center rounded-lg bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 px-2 text-[10px] text-slate-600">
                      <Zap size={11} className="text-amber-300" /> Uses verified sources · Actions require approval
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#09162f]">Needs your review</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {tasks.length ? `Aza paused ${tasks.length} action${tasks.length === 1 ? '' : 's'} for approval` : 'Nothing pending'}
                    </p>
                  </div>
                  <button onClick={() => setActive('Tasks & approvals')} className="text-[11px] text-cyan-300 hover:text-cyan-200">
                    View all
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-white/[0.06]">
                  {tasks.length === 0 && <p className="px-5 py-6 text-[11px] text-slate-400">No tasks awaiting review.</p>}
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-4">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-amber-300">
                        <FileText size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-slate-700">{task.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{task.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => resolveTask(task.id, 'approved')}
                          disabled={resolvingTaskId === task.id}
                          className="rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[10px] font-medium text-slate-700 transition hover:border-cyan-400/30 hover:text-cyan-200 disabled:opacity-40"
                        >
                          {task.action_label}
                        </button>
                        <button
                          onClick={() => resolveTask(task.id, 'dismissed')}
                          disabled={resolvingTaskId === task.id}
                          className="rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[10px] font-medium text-slate-500 transition hover:border-rose-400/30 hover:text-rose-300 disabled:opacity-40"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#09162f]">Lead pipeline</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Prospects discovered by Aza</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Filter leads"
                      value={leadFilter}
                      onChange={(event) => setLeadFilter(event.target.value)}
                      className="rounded-md border border-white/[0.09] bg-white px-2 py-1.5 text-[10px] text-slate-400 outline-none"
                    >
                      <option>All leads</option>
                      <option>New</option>
                      <option>Qualified</option>
                      <option>Researching</option>
                    </select>
                    <button className="grid size-7 place-items-center rounded-md border border-white/[0.09] text-slate-500 hover:text-slate-700">
                      <Filter size={13} />
                    </button>
                  </div>
                </div>
                {leads.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[11px] text-slate-400">
                    No leads yet. Ask Aza to start researching prospects, or add one manually.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead>
                        <tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-[0.13em] text-slate-600">
                          <th className="px-5 py-3 font-medium">Company</th>
                          <th className="px-3 py-3 font-medium">Contact</th>
                          <th className="px-3 py-3 font-medium">Fit score</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.018]">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className={`grid size-7 place-items-center rounded-md ${leadColors[lead.status] ?? 'bg-slate-400'} text-[9px] font-bold text-slate-950`}>
                                  {lead.company.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium text-slate-700">{lead.company}</p>
                                  <p className="mt-0.5 text-[9px] text-slate-600">{lead.detail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 text-[11px] text-slate-400">{lead.contact_name ?? '—'}</td>
                            <td className="px-3">
                              <span className="font-mono text-[11px] text-emerald-300">{lead.score ?? '—'}</span>
                            </td>
                            <td className="px-3">
                              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] text-slate-400">{lead.status}</span>
                            </td>
                            <td className="px-5 text-right">
                              <ArrowUpRight size={14} className="ml-auto text-slate-600" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#09162f]">Recent activity</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Your team and Aza</p>
                  </div>
                  <button onClick={() => setActive('Activity')} className="text-[11px] text-cyan-300">
                    See all
                  </button>
                </div>
                <div className="flex flex-col gap-5 p-5">
                  {activities.length === 0 && <p className="text-[11px] text-slate-400">No activity yet.</p>}
                  {activities.map((item) => {
                    const Icon = activityIcons[item.icon ?? ''] ?? Activity
                    return (
                      <div key={item.id} className="flex gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-slate-700">{item.title}</p>
                          <p className="mt-1 truncate text-[10px] text-slate-500">{item.detail}</p>
                          <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-600">
                            <Clock3 size={10} />
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <ShieldCheck size={13} className="text-cyan-300" />
                Aza will never send outreach or change external records without your approval.
              </div>
              <button className="text-[10px] text-slate-400 hover:text-slate-700">View audit log →</button>
            </div>
          </div>
        </section>
      </div>

      {showLeadModal && (
        <Modal onClose={() => setShowLeadModal(false)} title="Add lead">
          <div className="flex flex-col gap-3">
            <Field label="Company *">
              <input
                value={leadForm.company}
                onChange={(e) => setLeadForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                placeholder="Acme Corp"
              />
            </Field>
            <Field label="Detail">
              <input
                value={leadForm.detail}
                onChange={(e) => setLeadForm((f) => ({ ...f, detail: e.target.value }))}
                className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                placeholder="Why this is a fit"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name">
                <input
                  value={leadForm.contactName}
                  onChange={(e) => setLeadForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                />
              </Field>
              <Field label="Fit score (0-100)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={leadForm.score}
                  onChange={(e) => setLeadForm((f) => ({ ...f, score: e.target.value }))}
                  className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                />
              </Field>
            </div>
            <button
              onClick={submitLead}
              disabled={!leadForm.company.trim() || savingLead}
              className="mt-2 rounded-lg bg-cyan-400 px-3.5 py-2.5 text-[12px] font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
            >
              {savingLead ? 'Adding…' : 'Add lead'}
            </button>
          </div>
        </Modal>
      )}

      {showTaskModal && (
        <Modal onClose={() => setShowTaskModal(false)} title="Assign a task">
          <div className="flex flex-col gap-3">
            <Field label="Title *">
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                placeholder="Review draft outreach to Acme Corp"
              />
            </Field>
            <Field label="Detail">
              <input
                value={taskForm.detail}
                onChange={(e) => setTaskForm((f) => ({ ...f, detail: e.target.value }))}
                className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
              />
            </Field>
            <Field label="Action button label">
              <input
                value={taskForm.actionLabel}
                onChange={(e) => setTaskForm((f) => ({ ...f, actionLabel: e.target.value }))}
                className="w-full rounded-md border border-white/[0.09] bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
              />
            </Field>
            <button
              onClick={submitTask}
              disabled={!taskForm.title.trim() || savingTask}
              className="mt-2 rounded-lg bg-cyan-400 px-3.5 py-2.5 text-[12px] font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
            >
              {savingTask ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#09162f]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value, change, icon: Icon }: { label: string; value: string; change: string; icon: typeof CircleDollarSign }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <Icon size={15} className="text-cyan-300" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[23px] font-semibold tracking-[-0.04em] text-[#09162f]">{value}</span>
        {change && <span className="text-[10px] text-emerald-300">{change}</span>}
      </div>
    </div>
  )
}
