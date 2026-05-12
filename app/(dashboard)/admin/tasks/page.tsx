"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, isToday, startOfMonth, startOfWeek } from "date-fns"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

type TaskType =
  | "call"
  | "whatsapp"
  | "email"
  | "site_visit"
  | "meeting"
  | "follow_up"

type StatusFilter = "all" | "overdue" | "today" | "upcoming" | "completed"
type DateRangeFilter = "week" | "month" | "all"
type GroupMode = "flat" | "rep" | "status"

interface ProfileOption {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

interface LeadOption {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
}

interface AdminTask {
  id: string
  lead_id: string
  assigned_to: string
  title: string
  description: string | null
  type: string
  due_at: string
  completed_at: string | null
  created_at: string
  lead_name: string | null
  company_name: string | null
  phone: string | null
  stage_name: string | null
  stage_color: string | null
  rep_name: string | null
  rep_avatar_url: string | null
}

type RawTask = Omit<
  AdminTask,
  "lead_name" | "company_name" | "phone" | "stage_name" | "stage_color" | "rep_name" | "rep_avatar_url"
> & {
  lead:
    | {
        full_name: string | null
        company_name: string | null
        phone: string | null
        stage: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null
      }
    | Array<{
        full_name: string | null
        company_name: string | null
        phone: string | null
        stage: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null
      }>
    | null
  assigned_profile:
    | { full_name: string | null; avatar_url: string | null }
    | Array<{ full_name: string | null; avatar_url: string | null }>
    | null
}

interface Filters {
  repId: string
  taskType: string
  status: StatusFilter
  dateRange: DateRangeFilter
  search: string
}

const taskTypes: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow Up" },
]

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
]

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function getDayBounds() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86_400_000)
  return { today, tomorrow }
}

function getTaskStatus(task: AdminTask): StatusFilter {
  if (task.completed_at) return "completed"
  const due = new Date(task.due_at)
  const { today, tomorrow } = getDayBounds()
  if (due < today) return "overdue"
  if (due >= today && due < tomorrow) return "today"
  return "upcoming"
}

function getStatusLabel(status: StatusFilter) {
  if (status === "today") return "Due Today"
  if (status === "completed") return "Done"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getTaskIcon(type: string) {
  if (type === "call") return Phone
  if (type === "whatsapp") return MessageCircle
  if (type === "email") return Mail
  if (type === "site_visit") return MapPin
  if (type === "meeting") return Users
  if (type === "follow_up") return RefreshCw
  return ClipboardList
}

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"
}

function getDateRangeBounds(range: DateRangeFilter) {
  const now = new Date()
  if (range === "week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: null }
  }
  if (range === "month") {
    return { from: startOfMonth(now).toISOString(), to: null }
  }
  return { from: null, to: null }
}

async function fetchProfiles(): Promise<ProfileOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .in("role", ["sales_rep", "manager", "admin", "founder"])
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (error) throw error
  return (data ?? []) as ProfileOption[]
}

async function fetchAdminTasks(filters: Filters): Promise<AdminTask[]> {
  const supabase = createClient()
  const { from } = getDateRangeBounds(filters.dateRange)

  let query = supabase
    .from("tasks")
    .select(
      `
      id, lead_id, assigned_to, title, description, type, due_at, completed_at, created_at,
      lead:lead_id (
        full_name,
        company_name,
        phone,
        stage:stage_id (name, color)
      ),
      assigned_profile:assigned_to (full_name, avatar_url)
    `
    )
    .order("due_at", { ascending: true, nullsFirst: false })

  if (filters.status === "completed") {
    query = query.not("completed_at", "is", null)
  } else {
    query = query.is("completed_at", null)
  }

  if (filters.repId !== "all") query = query.eq("assigned_to", filters.repId)
  if (filters.taskType !== "all") query = query.eq("type", filters.taskType)
  if (from) query = query.gte("due_at", from)

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as RawTask[]).map((task) => {
    const lead = pickOne(task.lead)
    const stage = pickOne(lead?.stage)
    const rep = pickOne(task.assigned_profile)
    return {
      id: task.id,
      lead_id: task.lead_id,
      assigned_to: task.assigned_to,
      title: task.title,
      description: task.description,
      type: task.type,
      due_at: task.due_at,
      completed_at: task.completed_at,
      created_at: task.created_at,
      lead_name: lead?.full_name ?? null,
      company_name: lead?.company_name ?? null,
      phone: lead?.phone ?? null,
      stage_name: stage?.name ?? null,
      stage_color: stage?.color ?? null,
      rep_name: rep?.full_name ?? null,
      rep_avatar_url: rep?.avatar_url ?? null,
    }
  })
}

async function searchLeads(search: string): Promise<LeadOption[]> {
  const supabase = createClient()
  let query = supabase
    .from("leads")
    .select("id, full_name, company_name, phone")
    .order("full_name", { ascending: true })
    .limit(12)

  const term = search.trim()
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeadOption[]
}

export default function AdminTasksPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const setLeadDrawerId = useUIStore((s) => s.setLeadDrawerId)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [filters, setFilters] = useState<Filters>({
    repId: "all",
    taskType: "all",
    status: "all",
    dateRange: "week",
    search: "",
  })
  const [page, setPage] = useState(1)
  const [groupMode, setGroupMode] = useState<GroupMode>("flat")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [isAddOpen, setIsAddOpen] = useState(false)

  useEffect(() => {
    getCachedUserAndProfile().then(({ user, profile }) => {
      const role = profile?.role as UserRole | undefined
      if (!user) {
        router.replace("/login")
        return
      }
      if (role === "sales_rep" || role === "marketing") {
        router.replace("/activities")
        return
      }
      if (!role || !["admin", "manager", "founder"].includes(role)) {
        router.replace("/activities")
        return
      }
      setCurrentUserId(user.id)
      setCheckingAccess(false)
    })
  }, [router])

  const profilesQuery = useQuery({
    queryKey: ["task-rep-options"],
    queryFn: fetchProfiles,
  })

  const tasksQuery = useQuery({
    queryKey: ["admin-tasks", filters],
    queryFn: () => fetchAdminTasks(filters),
    enabled: !checkingAccess,
    refetchInterval: 60_000,
  })

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", taskId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Task completed")
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to complete task")
    },
  })

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return (tasksQuery.data ?? [])
      .filter((task) => {
        const status = getTaskStatus(task)
        if (filters.status !== "all" && status !== filters.status) return false
        if (!search) return true
        return (
          task.title.toLowerCase().includes(search) ||
          (task.lead_name ?? "").toLowerCase().includes(search)
        )
      })
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
  }, [filters.search, filters.status, tasksQuery.data])

  const kpis = useMemo(() => {
    const openTasks = filteredTasks.filter((task) => !task.completed_at)
    return {
      overdue: openTasks.filter((task) => getTaskStatus(task) === "overdue").length,
      today: openTasks.filter((task) => getTaskStatus(task) === "today").length,
      upcoming: openTasks.filter((task) => getTaskStatus(task) === "upcoming").length,
    }
  }, [filteredTasks])

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / 25))
  const safePage = Math.min(page, totalPages)
  const pageTasks = filteredTasks.slice((safePage - 1) * 25, safePage * 25)

  useEffect(() => {
    setPage(1)
    setExpandedGroups(new Set())
  }, [filters, groupMode])

  if (checkingAccess) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-0">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 px-4 py-4 md:mb-5 md:px-0 md:py-0 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              All Tasks
            </h1>
            <p className="mt-0.5 text-sm text-[#9090A8]">
              Every task across all leads and reps
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center">
            <KpiBadge tone="red" label="Overdue" value={kpis.overdue} />
            <KpiBadge tone="amber" label="Due Today" value={kpis.today} />
            <KpiBadge tone="surface" label="Upcoming" value={kpis.upcoming} />
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="col-span-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white transition hover:bg-[#2563EB] md:col-span-1 md:h-9 lg:ml-2"
            >
              <Plus className="size-4" />
              Add Task
            </button>
          </div>
        </div>

        <FilterBar
          filters={filters}
          reps={profilesQuery.data ?? []}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        />

        <section className="mt-4 overflow-hidden border-y border-[#2A2A3C] bg-[#111118] md:rounded-xl md:border">
          <div className="flex flex-col gap-3 border-b border-[#2A2A3C] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#9090A8]">
              {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} found
            </p>
            <button
              type="button"
              onClick={() =>
                setGroupMode((mode) =>
                  mode === "flat" ? "rep" : mode === "rep" ? "status" : "flat"
                )
              }
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
            >
              <ChevronDown className="size-3.5" />
              {groupMode === "flat"
                ? "Group by Rep"
                : groupMode === "rep"
                  ? "Group by Status"
                  : "Flat View"}
            </button>
          </div>

          {tasksQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-[#9090A8]" />
            </div>
          ) : tasksQuery.isError ? (
            <div className="p-8 text-center text-sm text-[#F87171]">
              {tasksQuery.error instanceof Error ? tasksQuery.error.message : "Failed to load tasks"}
            </div>
          ) : pageTasks.length === 0 ? (
            <EmptyState />
          ) : isMobile ? (
            <MobileAdminTaskList
              tasks={pageTasks}
              completingId={completeMutation.variables}
              onComplete={(taskId) => completeMutation.mutate(taskId)}
              onOpenLead={setLeadDrawerId}
            />
          ) : groupMode === "flat" ? (
            <TaskTable
              tasks={pageTasks}
              rowOffset={(safePage - 1) * 25}
              completingId={completeMutation.variables}
              onComplete={(taskId) => completeMutation.mutate(taskId)}
              onOpenLead={setLeadDrawerId}
            />
          ) : (
            <GroupedTasks
              mode={groupMode}
              tasks={pageTasks}
              expandedGroups={expandedGroups}
              onToggleGroup={(key) =>
                setExpandedGroups((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
              completingId={completeMutation.variables}
              onComplete={(taskId) => completeMutation.mutate(taskId)}
              onOpenLead={setLeadDrawerId}
            />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#2A2A3C] px-4 py-3">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex-1 rounded-xl border border-[#2A2A3C] px-3 py-3 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24] disabled:opacity-40 md:flex-none md:rounded-lg md:py-1.5 md:text-xs"
            >
              Previous
            </button>
            <span className="text-xs text-[#9090A8]">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex-1 rounded-xl border border-[#2A2A3C] px-3 py-3 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24] disabled:opacity-40 md:flex-none md:rounded-lg md:py-1.5 md:text-xs"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      <AddTaskModal
        open={isAddOpen}
        currentUserId={currentUserId}
        reps={profilesQuery.data ?? []}
        onClose={() => setIsAddOpen(false)}
        onCreated={() => {
          setIsAddOpen(false)
          queryClient.invalidateQueries({ queryKey: ["admin-tasks"] })
          queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
        }}
      />
    </main>
  )
}

function KpiBadge({
  tone,
  label,
  value,
}: {
  tone: "red" | "amber" | "surface"
  label: string
  value: number
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
        tone === "red" && "bg-[#7F1D1D] text-white",
        tone === "amber" && "bg-[#92400E] text-white",
        tone === "surface" && "border border-[#2A2A3C] bg-[#111118] text-[#F0F0FA]"
      )}
    >
      <span aria-hidden>{tone === "red" ? "🔴" : tone === "amber" ? "🟡" : "⚪"}</span>
      {label}: {value}
    </span>
  )
}

function FilterBar({
  filters,
  reps,
  onChange,
}: {
  filters: Filters
  reps: ProfileOption[]
  onChange: (patch: Partial<Filters>) => void
}) {
  return (
    <div className="mx-4 grid gap-3 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 md:mx-0 xl:grid-cols-[180px_170px_1fr_160px_240px]">
      <NativeSelect
        label="Assigned Rep"
        value={filters.repId}
        onChange={(value) => onChange({ repId: value })}
        options={[
          { value: "all", label: "All Reps" },
          ...reps.map((rep) => ({ value: rep.id, label: rep.full_name })),
        ]}
      />
      <NativeSelect
        label="Task Type"
        value={filters.taskType}
        onChange={(value) => onChange({ taskType: value })}
        options={taskTypes}
      />
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase text-[#9090A8]">Status</p>
        <div className="grid w-full grid-cols-5 gap-1 rounded-xl bg-[#1A1A24] p-1">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange({ status: item.value })}
              className={cn(
                "flex min-h-[40px] items-center justify-center rounded-lg px-1 py-2 text-center text-[11px] font-medium leading-tight transition-all duration-200",
                filters.status === item.value
                  ? "bg-[#3B82F6] text-white shadow-sm"
                  : "text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <NativeSelect
        label="Date Range"
        value={filters.dateRange}
        onChange={(value) => onChange({ dateRange: value as DateRangeFilter })}
        options={[
          { value: "week", label: "This Week" },
          { value: "month", label: "This Month" },
          { value: "all", label: "All Time" },
        ]}
      />
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase text-[#9090A8]">Search</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Lead or task"
            className="w-full rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] py-3 pl-9 pr-3 text-base text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6] md:py-2.5 md:text-sm"
          />
        </div>
      </div>
    </div>
  )
}

function NativeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] px-3 py-3 text-base text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] md:py-2.5 md:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TaskTable({
  tasks,
  rowOffset,
  completingId,
  onComplete,
  onOpenLead,
}: {
  tasks: AdminTask[]
  rowOffset: number
  completingId?: string
  onComplete: (taskId: string) => void
  onOpenLead: (leadId: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-sm">
        <thead>
          <tr className="border-b border-[#2A2A3C] text-[11px] uppercase text-[#9090A8]">
            {["#", "Task", "Lead", "Company", "Stage", "Assigned To", "Due Date", "Status", "Action"].map((head, index) => (
              <th key={head} className={cn("px-4 py-3 font-medium", index === 0 ? "text-right" : "text-left")}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={rowOffset + index + 1}
              completingId={completingId}
              onComplete={onComplete}
              onOpenLead={onOpenLead}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobileAdminTaskList({
  tasks,
  completingId,
  onComplete,
  onOpenLead,
}: {
  tasks: AdminTask[]
  completingId?: string
  onComplete: (taskId: string) => void
  onOpenLead: (leadId: string) => void
}) {
  return (
    <div className="space-y-3 px-4 py-3">
      {tasks.map((task) => {
        const status = getTaskStatus(task)
        const isCompleting = completingId === task.id
        const isOverdue = status === "overdue"
        const isTodayStatus = status === "today"

        return (
          <div
            key={task.id}
            className="rounded-xl border border-l-2 border-[#2A2A3C] bg-[#111118] p-4"
            style={{
              borderLeftColor: isOverdue ? "#EF4444" : isTodayStatus ? "#F59E0B" : "#2A2A3C",
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm font-medium text-[#F0F0FA]">
                {task.title}
              </p>
              <span
                className={cn(
                  "flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-medium",
                  isOverdue && "bg-red-500/20 text-red-400",
                  isTodayStatus && "bg-amber-500/20 text-amber-400",
                  !isOverdue && !isTodayStatus && "bg-[#1A1A24] text-[#9090A8]"
                )}
              >
                {isOverdue ? "Overdue" : isTodayStatus ? "Due Today" : getStatusLabel(status)}
              </span>
            </div>

            <div className="mb-3 flex justify-between gap-3 text-xs text-[#9090A8]">
              <button
                type="button"
                className="min-w-0 truncate text-left underline"
                onClick={() => onOpenLead(task.lead_id)}
              >
                {task.lead_name ?? "Unknown lead"}
              </button>
              <span className="min-w-0 truncate">{task.rep_name ?? "Unassigned"}</span>
            </div>

            <p className="mb-3 flex items-center gap-1 text-xs text-[#9090A8]">
              <CalendarClock className="size-3" />
              {format(new Date(task.due_at), "dd MMM, hh:mm a")}
            </p>

            {status === "completed" ? (
              <p className="rounded-xl bg-[#163322] py-2.5 text-center text-sm font-medium text-[#34D399]">
                Completed
              </p>
            ) : (
              <button
                type="button"
                disabled={isCompleting}
                onClick={() => onComplete(task.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981]/10 py-2.5 text-sm font-medium text-[#10B981] disabled:opacity-60"
              >
                {isCompleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Mark Complete
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TaskRow({
  task,
  index,
  completingId,
  onComplete,
  onOpenLead,
}: {
  task: AdminTask
  index: number
  completingId?: string
  onComplete: (taskId: string) => void
  onOpenLead: (leadId: string) => void
}) {
  const status = getTaskStatus(task)
  const Icon = getTaskIcon(task.type)
  const isCompleting = completingId === task.id

  return (
    <tr
      className={cn(
        "border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]",
        status === "overdue" && "border-l-2 border-l-[#EF4444] bg-[#2A1215]/30",
        status === "today" && "border-l-2 border-l-[#F59E0B] bg-[#2A1F10]/30",
        status === "completed" && "opacity-50"
      )}
    >
      <td className="px-4 py-3 text-right text-[#9090A8]">{index}</td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-[#3B82F6]" />
          <span
            className={cn(
              "truncate font-medium text-[#F0F0FA]",
              status === "completed" && "line-through"
            )}
          >
            {task.title}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenLead(task.lead_id)}
          className="max-w-[160px] truncate text-left font-medium text-[#3B82F6] transition hover:text-[#60A5FA]"
        >
          {task.lead_name ?? "Unknown lead"}
        </button>
      </td>
      <td className="px-4 py-3 text-[#9090A8]">{task.company_name ?? "-"}</td>
      <td className="px-4 py-3">
        {task.stage_name ? (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: task.stage_color ?? "#6B7280" }}
          >
            {task.stage_name}
          </span>
        ) : (
          <span className="text-[#5A5A72]">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[11px] font-semibold text-[#3B82F6]">
            {initials(task.rep_name)}
          </span>
          <span className="max-w-[140px] truncate text-[#F0F0FA]">
            {task.rep_name ?? "Unassigned"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap",
            status === "overdue" && "text-[#F87171]",
            status === "today" && "text-[#FBBF24]",
            status !== "overdue" && status !== "today" && "text-[#9090A8]"
          )}
        >
          {status === "overdue" && <AlertTriangle className="size-3.5" />}
          {isToday(new Date(task.due_at)) && status !== "overdue" && (
            <CalendarClock className="size-3.5" />
          )}
          {format(new Date(task.due_at), "dd MMM, hh:mm a")}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={status} />
      </td>
      <td className="px-4 py-3">
        {status === "completed" ? (
          <span className="text-xs text-[#5A5A72]">Completed</span>
        ) : (
          <button
            type="button"
            disabled={isCompleting}
            onClick={() => onComplete(task.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#10B981] px-3 text-xs font-medium text-white transition hover:bg-[#059669] disabled:opacity-60"
          >
            {isCompleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            Mark Complete
          </button>
        )}
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: StatusFilter }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "overdue" && "bg-[#7F1D1D] text-white",
        status === "today" && "bg-[#92400E] text-white",
        status === "upcoming" && "bg-[#1A1A24] text-[#C7C7D8]",
        status === "completed" && "bg-[#163322] text-[#34D399]"
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}

function GroupedTasks({
  mode,
  tasks,
  expandedGroups,
  onToggleGroup,
  completingId,
  onComplete,
  onOpenLead,
}: {
  mode: Exclude<GroupMode, "flat">
  tasks: AdminTask[]
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
  completingId?: string
  onComplete: (taskId: string) => void
  onOpenLead: (leadId: string) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; tasks: AdminTask[] }>()
    for (const task of tasks) {
      const key = mode === "rep" ? task.assigned_to : getTaskStatus(task)
      const label = mode === "rep" ? task.rep_name ?? "Unassigned" : getStatusLabel(getTaskStatus(task))
      const group = map.get(key) ?? { label, tasks: [] }
      group.tasks.push(task)
      map.set(key, group)
    }
    return Array.from(map.entries())
  }, [mode, tasks])

  return (
    <div className="divide-y divide-[#2A2A3C]">
      {groups.map(([key, group]) => {
        const isExpanded = expandedGroups.has(key)
        const overdueCount = group.tasks.filter((task) => getTaskStatus(task) === "overdue").length
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => onToggleGroup(key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#1A1A24]"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[#F0F0FA]">
                <ChevronDown
                  className={cn("size-4 text-[#9090A8] transition", isExpanded && "rotate-180")}
                />
                {group.label}
              </span>
              <span className="text-xs text-[#9090A8]">
                {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}
                {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
              </span>
            </button>
            {isExpanded && (
              <TaskTable
                tasks={group.tasks}
                rowOffset={0}
                completingId={completingId}
                onComplete={onComplete}
                onOpenLead={onOpenLead}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <CheckCircle2 className="mb-3 size-9 text-[#10B981]" />
      <p className="text-sm font-medium text-[#F0F0FA]">No tasks found</p>
      <p className="mt-1 text-sm text-[#9090A8]">Try changing the filters above</p>
    </div>
  )
}

function AddTaskModal({
  open,
  currentUserId,
  reps,
  onClose,
  onCreated,
}: {
  open: boolean
  currentUserId: string | null
  reps: ProfileOption[]
  onClose: () => void
  onCreated: () => void
}) {
  const [leadSearch, setLeadSearch] = useState("")
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)
  const [type, setType] = useState<TaskType>("call")
  const [title, setTitle] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  useEffect(() => {
    if (open && currentUserId) setAssignedTo(currentUserId)
  }, [currentUserId, open])

  const leadsQuery = useQuery({
    queryKey: ["admin-task-lead-search", leadSearch],
    queryFn: () => searchLeads(leadSearch),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead) throw new Error("Choose a lead")
      if (!title.trim()) throw new Error("Add a task title")
      if (!dueAt) throw new Error("Choose a due date")
      if (!assignedTo) throw new Error("Choose an assignee")

      const supabase = createClient()
      const { error } = await supabase.from("tasks").insert({
        lead_id: selectedLead.id,
        type,
        title: title.trim(),
        due_at: new Date(dueAt).toISOString(),
        assigned_to: assignedTo,
        created_by: currentUserId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Task added")
      setLeadSearch("")
      setSelectedLead(null)
      setType("call")
      setTitle("")
      setDueAt("")
      onCreated()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add task")
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2A3C] px-5 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#F0F0FA]">
              Add Task
            </h2>
            <p className="text-xs text-[#9090A8]">Create a task for any lead and rep.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase text-[#9090A8]">Lead</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#5A5A72]" />
              <input
                value={selectedLead ? selectedLead.full_name : leadSearch}
                onChange={(e) => {
                  setSelectedLead(null)
                  setLeadSearch(e.target.value)
                }}
                placeholder="Search by name or phone"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] pl-9 pr-3 text-sm text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
              />
            </div>
            {!selectedLead && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#2A2A3C] bg-[#0A0A0F]">
                {leadsQuery.isLoading ? (
                  <div className="flex h-20 items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-[#9090A8]" />
                  </div>
                ) : (
                  (leadsQuery.data ?? []).map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLead(lead)}
                      className="flex w-full items-center justify-between gap-3 border-b border-[#2A2A3C]/60 px-3 py-2 text-left transition last:border-b-0 hover:bg-[#1A1A24]"
                    >
                      <span>
                        <span className="block text-sm font-medium text-[#F0F0FA]">
                          {lead.full_name}
                        </span>
                        <span className="block text-xs text-[#9090A8]">
                          {lead.company_name ?? lead.phone ?? "No company"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NativeSelect
              label="Task Type"
              value={type}
              onChange={(value) => setType(value as TaskType)}
              options={taskTypes.filter((item) => item.value !== "all")}
            />
            <NativeSelect
              label="Assign To"
              value={assignedTo}
              onChange={setAssignedTo}
              options={reps.map((rep) => ({ value: rep.id, label: rep.full_name }))}
            />
          </div>

          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] px-3 text-sm text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
              Due Date
            </span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2A2A3C] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#2A2A3C] px-4 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-60"
          >
            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
