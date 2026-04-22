"use client"

import { useEffect, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  ChevronDown,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  Calendar as CalendarIcon,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"

// ── Types ───────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  description: string | null
  type: string
  due_at: string
  completed_at: string | null
  created_at: string
  lead: { id: string; full_name: string; company_name: string | null; stage_id: string | null } | null
  assignee: { id: string; full_name: string } | null
  creator: { id: string; full_name: string } | null
}

type RawTask = Omit<TaskRow, "lead" | "assignee" | "creator"> & {
  lead: TaskRow["lead"] | TaskRow["lead"][] | null
  assignee: TaskRow["assignee"] | TaskRow["assignee"][] | null
  creator: TaskRow["creator"] | TaskRow["creator"][] | null
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

/**
 * Render the "Assigned by …" line for a task.
 *   - creator + creator ≠ assignee → "Assigned by <creator>"
 *   - creator + creator  = assignee → "Self assigned"
 *   - no creator at all             → "Assigned by Admin"
 *     (legacy rows predating the created_by fix — better label than "System")
 */
function formatAssignedBy(task: TaskRow): string {
  if (!task.creator) return "Assigned by Admin"
  if (task.assignee && task.creator.id === task.assignee.id) return "Self assigned"
  return `Assigned by ${task.creator.full_name}`
}

// ── Page ────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const { setLeadDrawerId } = useUIStore()

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Expanded card ids (multi-expand allowed)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Tasks currently being marked complete (show spinner)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  // Tasks in the fade-out animation before being removed from the list
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchTasks() {
      const supabase = createClient()

      // Shared cache avoids the auth-token lock race with other
      // hooks that mount at the same time (kanban, drawer, sidebar).
      const { user, profile } = await getCachedUserAndProfile()
      if (!user) {
        setLoading(false)
        return
      }

      const role = (profile?.role as string | undefined) ?? ""
      const isManager = ["admin", "manager", "founder"].includes(role)

      let query = supabase
        .from("tasks")
        .select(
          `
          id, title, description, type, due_at, completed_at, created_at,
          lead:lead_id (id, full_name, company_name, stage_id),
          assignee:assigned_to (id, full_name),
          creator:created_by (id, full_name)
        `
        )
        .is("completed_at", null)
        .order("due_at", { ascending: true })

      if (!isManager) {
        query = query.eq("assigned_to", user.id)
      }

      const { data, error } = await query

      if (error) {
        setFetchError(error.message)
        setTasks([])
      } else {
        const normalised: TaskRow[] = ((data ?? []) as RawTask[]).map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          type: t.type,
          due_at: t.due_at,
          completed_at: t.completed_at,
          created_at: t.created_at,
          lead: pickOne(t.lead),
          assignee: pickOne(t.assignee),
          creator: pickOne(t.creator),
        }))
        setTasks(normalised)
      }
      setLoading(false)
    }

    fetchTasks()
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleComplete = async (taskId: string) => {
    if (completingIds.has(taskId) || removingIds.has(taskId)) return

    setCompletingIds((prev) => new Set(prev).add(taskId))

    const supabase = createClient()
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", taskId)

    if (error) {
      setCompletingIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      toast.error(`Failed to complete task: ${error.message}`)
      return
    }

    // Trigger fade-out, then remove from the list
    setRemovingIds((prev) => new Set(prev).add(taskId))
    setCompletingIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
    toast.success("Task completed!")

    window.setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }, 320)
  }

  // Grouping
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  const overdue = tasks.filter((t) => new Date(t.due_at) < today)
  const dueToday = tasks.filter((t) => {
    const d = new Date(t.due_at)
    return d >= today && d < tomorrow
  })
  const upcoming = tasks.filter((t) => new Date(t.due_at) >= tomorrow)

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "800px" }}>
        <div
          className="animate-pulse"
          style={{
            height: 28,
            width: 140,
            borderRadius: 6,
            background: "#1A1A24",
            marginBottom: 12,
          }}
        />
        <div
          className="animate-pulse"
          style={{
            height: 14,
            width: 100,
            borderRadius: 4,
            background: "#1A1A24",
            marginBottom: 32,
          }}
        />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              background: "#111118",
              border: "1px solid #2A2A3C",
              borderLeft: "3px solid #2A2A3C",
              borderRadius: 8,
              padding: 16,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  height: 14,
                  width: "60%",
                  background: "#1A1A24",
                  borderRadius: 4,
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "45%",
                  background: "#1A1A24",
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              />
              <div
                style={{
                  height: 10,
                  width: "30%",
                  background: "#1A1A24",
                  borderRadius: 4,
                }}
              />
            </div>
            <div
              style={{
                height: 22,
                width: 60,
                background: "#1A1A24",
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: "24px", maxWidth: "800px" }}>
      <h1
        style={{
          color: "#F0F0FA",
          fontSize: "24px",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        My Tasks
      </h1>
      <p style={{ color: "#9090A8", marginBottom: "32px" }}>
        {tasks.length} open task{tasks.length !== 1 ? "s" : ""}
      </p>

      {fetchError && (
        <div
          style={{
            background: "#2A1215",
            border: "1px solid #7F1D1D",
            color: "#F87171",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "13px",
          }}
        >
          Supabase error: {fetchError}
        </div>
      )}

      {tasks.length === 0 && !fetchError && (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            color: "#5A5A72",
            background: "#111118",
            borderRadius: "12px",
            border: "1px solid #2A2A3C",
          }}
        >
          No open tasks assigned to you.
        </div>
      )}

      <TaskGroup
        heading="OVERDUE"
        headingColor="#EF4444"
        accentColor="#EF4444"
        tasks={overdue}
        expandedIds={expandedIds}
        completingIds={completingIds}
        removingIds={removingIds}
        onToggle={toggleExpand}
        onComplete={handleComplete}
        onOpenLead={setLeadDrawerId}
      />

      <TaskGroup
        heading="DUE TODAY"
        headingColor="#F59E0B"
        accentColor="#F59E0B"
        tasks={dueToday}
        expandedIds={expandedIds}
        completingIds={completingIds}
        removingIds={removingIds}
        onToggle={toggleExpand}
        onComplete={handleComplete}
        onOpenLead={setLeadDrawerId}
      />

      <TaskGroup
        heading="UPCOMING"
        headingColor="#9090A8"
        accentColor="#3B82F6"
        tasks={upcoming}
        expandedIds={expandedIds}
        completingIds={completingIds}
        removingIds={removingIds}
        onToggle={toggleExpand}
        onComplete={handleComplete}
        onOpenLead={setLeadDrawerId}
      />
    </div>
  )
}

// ── Task group ──────────────────────────────────────────────────────

interface TaskGroupProps {
  heading: string
  headingColor: string
  accentColor: string
  tasks: TaskRow[]
  expandedIds: Set<string>
  completingIds: Set<string>
  removingIds: Set<string>
  onToggle: (id: string) => void
  onComplete: (id: string) => void
  onOpenLead: (id: string) => void
}

function TaskGroup({
  heading,
  headingColor,
  accentColor,
  tasks,
  expandedIds,
  completingIds,
  removingIds,
  onToggle,
  onComplete,
  onOpenLead,
}: TaskGroupProps) {
  if (tasks.length === 0) return null

  return (
    <div style={{ marginBottom: "24px" }}>
      <h2
        style={{
          color: headingColor,
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "12px",
          letterSpacing: "1px",
        }}
      >
        {heading}
      </h2>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          accentColor={accentColor}
          isExpanded={expandedIds.has(task.id)}
          isCompleting={completingIds.has(task.id)}
          isRemoving={removingIds.has(task.id)}
          onToggle={() => onToggle(task.id)}
          onComplete={() => onComplete(task.id)}
          onOpenLead={onOpenLead}
        />
      ))}
    </div>
  )
}

// ── Task card ───────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskRow
  accentColor: string
  isExpanded: boolean
  isCompleting: boolean
  isRemoving: boolean
  onToggle: () => void
  onComplete: () => void
  onOpenLead: (id: string) => void
}

function TaskCard({
  task,
  accentColor,
  isExpanded,
  isCompleting,
  isRemoving,
  onToggle,
  onComplete,
  onOpenLead,
}: TaskCardProps) {
  const dueDate = new Date(task.due_at)
  const dueShort = format(dueDate, "d MMM yyyy")
  const dueLong = format(dueDate, "EEEE, d MMM yyyy")

  return (
    <div
      style={{
        background: isExpanded ? "#1A1A24" : "#111118",
        border: "1px solid #2A2A3C",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "8px",
        marginBottom: isRemoving ? "0" : "8px",
        overflow: "hidden",
        transition:
          "background 200ms, opacity 300ms, max-height 320ms, margin 320ms, transform 320ms",
        opacity: isRemoving ? 0 : 1,
        maxHeight: isRemoving ? 0 : "800px",
        transform: isRemoving ? "scale(0.97)" : "scale(1)",
      }}
    >
      {/* Collapsed header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          padding: "16px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: "#F0F0FA",
              fontWeight: 500,
              margin: "0 0 4px",
              fontSize: "14px",
            }}
          >
            {task.title}
          </p>
          <p style={{ color: "#9090A8", fontSize: "13px", margin: 0 }}>
            {task.lead?.full_name ?? "Unknown lead"}
            {task.lead?.company_name ? ` · ${task.lead.company_name}` : ""}
          </p>
          <p style={{ color: "#5A5A72", fontSize: "12px", margin: "4px 0 0" }}>
            Due: {dueShort}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              background: "#1F1F2E",
              color: "#9090A8",
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {task.type.replace("_", " ")}
          </span>
          <ChevronDown
            size={16}
            style={{
              color: "#9090A8",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        </div>
      </div>

      {/* Expanded details — max-height transition */}
      <div
        style={{
          maxHeight: isExpanded ? "600px" : "0px",
          overflow: "hidden",
          transition: "max-height 300ms ease",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid #2A2A3C",
            display: "grid",
            gap: "14px",
          }}
        >
          {/* Full due date */}
          <DetailRow icon={<CalendarIcon size={14} />} label={dueLong} />

          {/* Description */}
          <div
            style={{
              background: "#1F1F2E",
              borderRadius: "6px",
              padding: "12px",
              color: task.description ? "#F0F0FA" : "#5A5A72",
              fontSize: "13px",
              lineHeight: 1.5,
              fontStyle: task.description ? "normal" : "italic",
              whiteSpace: "pre-wrap",
            }}
          >
            {task.description?.trim() ? task.description : "No description added"}
          </div>

          {/* Assignment meta */}
          <div style={{ display: "grid", gap: "6px", fontSize: "13px" }}>
            <DetailRow
              icon={<UserIcon size={14} />}
              label={formatAssignedBy(task)}
            />
            <DetailRow
              icon={<UserIcon size={14} />}
              label={`Assigned to ${task.assignee?.full_name ?? "—"}`}
            />
            {task.lead && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#9090A8",
                }}
              >
                <ExternalLink size={14} style={{ color: "#5A5A72" }} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (task.lead) onOpenLead(task.lead.id)
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#3B82F6",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  Open {task.lead.full_name}
                </button>
              </div>
            )}
            <p style={{ color: "#5A5A72", fontSize: "12px", margin: "2px 0 0" }}>
              Assigned{" "}
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Mark Complete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onComplete()
            }}
            disabled={isCompleting}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: isCompleting ? "#0E7A5B" : "#10B981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: isCompleting ? "progress" : "pointer",
              opacity: isCompleting ? 0.85 : 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "6px",
              transition: "background 150ms",
            }}
          >
            {isCompleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Completing…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                Mark Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#9090A8",
      }}
    >
      <span style={{ color: "#5A5A72" }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}
