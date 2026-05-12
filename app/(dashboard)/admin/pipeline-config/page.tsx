"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  GripVertical,
  Loader2,
  Save,
  Trash2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import type { PipelineStage } from "@/lib/types"
import { cn } from "@/lib/utils"

interface StageRow extends PipelineStage {
  active_lead_count: number
}

async function fetchStagesWithCounts(): Promise<StageRow[]> {
  const supabase = createClient()
  const [stagesRes, leadsRes] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position", { ascending: true }),
    supabase.from("leads").select("stage_id"),
  ])

  if (stagesRes.error) throw stagesRes.error
  if (leadsRes.error) throw leadsRes.error

  const counts = new Map<string, number>()
  for (const l of leadsRes.data ?? []) {
    counts.set(l.stage_id, (counts.get(l.stage_id) ?? 0) + 1)
  }

  return ((stagesRes.data ?? []) as PipelineStage[]).map((s) => ({
    ...s,
    active_lead_count: counts.get(s.id) ?? 0,
  }))
}

// ── Sortable row ──────────────────────────────────────────────────

interface SortableStageRowProps {
  stage: StageRow
  onChange: (id: string, patch: Partial<StageRow>) => void
  onDelete: (id: string) => void
}

function SortableStageRow({ stage, onChange, onDelete }: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })

  const canDelete = stage.active_lead_count === 0

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2.5",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-[#9090A8] transition hover:text-[#F0F0FA] active:cursor-grabbing"
        type="button"
      >
        <GripVertical className="size-4" />
      </button>

      <input
        type="color"
        value={stage.color}
        onChange={(e) => onChange(stage.id, { color: e.target.value })}
        className="size-8 shrink-0 cursor-pointer rounded border border-[#2A2A3C] bg-transparent"
      />

      <input
        type="text"
        value={stage.name}
        onChange={(e) => onChange(stage.id, { name: e.target.value })}
        className="min-w-0 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
      />

      <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#9090A8]">
        <span className="capitalize">{stage.stage_type}</span>
        <span>·</span>
        <span>
          {stage.active_lead_count} lead{stage.active_lead_count === 1 ? "" : "s"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onDelete(stage.id)}
        disabled={!canDelete}
        title={
          canDelete
            ? "Delete stage"
            : `Cannot delete — ${stage.active_lead_count} leads in this stage`
        }
        className={cn(
          "shrink-0 rounded-md border p-1.5 transition",
          canDelete
            ? "border-[#2A2A3C] text-[#F87171] hover:bg-[#2A1215]"
            : "cursor-not-allowed border-[#2A2A3C] text-[#9090A8]/40"
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function PipelineConfigPage() {
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const queryClient = useQueryClient()
  const [stages, setStages] = useState<StageRow[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pipeline-stages"],
    queryFn: fetchStagesWithCounts,
  })

  useEffect(() => {
    if (data) {
      setStages(data)
      setDeletedIds([])
      setDirty(false)
    }
  }, [data])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setStages((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
    setDirty(true)
  }

  const handleChange = (id: string, patch: Partial<StageRow>) => {
    setStages((items) => items.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    setDirty(true)
  }

  const handleDelete = (id: string) => {
    const stage = stages.find((s) => s.id === id)
    if (!stage || stage.active_lead_count > 0) return
    if (!confirm(`Delete stage "${stage.name}"?`)) return
    setStages((items) => items.filter((s) => s.id !== id))
    setDeletedIds((prev) => [...prev, id])
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    try {
      // Delete removed stages
      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from("pipeline_stages")
          .delete()
          .in("id", deletedIds)
        if (error) throw error
      }

      // Update remaining stages (position + name + color)
      const updates = stages.map((s, idx) =>
        supabase
          .from("pipeline_stages")
          .update({ name: s.name, color: s.color, position: idx })
          .eq("id", s.id)
      )
      const results = await Promise.all(updates)
      const firstError = results.find((r) => r.error)
      if (firstError?.error) throw firstError.error

      toast.success("Pipeline saved")
      queryClient.invalidateQueries({ queryKey: ["admin-pipeline-stages"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-stages"] })
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="mx-4 mb-4 mt-4 rounded-lg bg-[#1A1A24] p-2 text-[#9090A8] md:hidden"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="px-4 pb-4 md:mb-5 md:flex md:items-center md:justify-between md:gap-3 md:px-0 md:pb-0">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden size-8 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:text-[#F0F0FA] md:flex"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[#F0F0FA] md:font-[family-name:var(--font-heading)] md:text-2xl md:font-semibold">
                Pipeline Config
              </h1>
              <p className="text-sm text-[#9090A8]">
                Drag to reorder. Edit names and colors inline.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="hidden items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50 md:inline-flex"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Save Changes
          </button>
        </div>

        {/* Stage list */}
        <div className="mx-4 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 md:mx-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-[#9090A8]" />
            </div>
          ) : stages.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#9090A8]">No stages configured</div>
          ) : (
            isMobile ? (
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => handleChange(stage.id, { color: e.target.value })}
                        className="size-10 flex-shrink-0 cursor-pointer rounded-xl border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => handleChange(stage.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded-xl border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2.5 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                      />
                      <span className="flex-shrink-0 text-xs text-[#5A5A72]">#{index + 1}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9090A8]">{stage.active_lead_count} active leads</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(stage.id)}
                        disabled={stage.active_lead_count > 0}
                        className="rounded-lg bg-[#EF4444]/10 px-3 py-1.5 text-xs font-medium text-[#EF4444] disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="mt-2 w-full rounded-xl bg-[#3B82F6] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      onChange={handleChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            )
          )}
        </div>
      </div>
    </main>
  )
}
