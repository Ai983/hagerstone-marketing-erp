"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, Star, Tags } from "lucide-react"

import { TAGS_KEY, useTags } from "@/lib/hooks/useTags"
import { createClient } from "@/lib/supabase/client"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLORS = [
  "#F59E0B", "#10B981", "#C084FC", "#60A5FA", "#38BDF8", "#818CF8", "#2DD4BF",
  "#34D399", "#F87171", "#FB923C", "#EF4444", "#F472B6", "#A3E635", "#9090A8",
]

/**
 * The shared tag list. Anyone can add a tag from a tag picker; this page
 * is for tidying — rename, recolour, mark important (shown on Kanban
 * cards) or retire. Retired tags stay on records but leave the picker.
 */
export default function TagsAdminPage() {
  const queryClient = useQueryClient()
  const { tags, isLoading, error, createTag } = useTags()
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)

  // How many leads carry each tag — so nobody retires one still in use unaware.
  const usage = useQuery({
    queryKey: ["tag-usage"],
    queryFn: async () => {
      const { data, error: err } = await createClient().from("leads").select("tag_ids").not("tag_ids", "eq", "{}")
      if (err) throw err
      const counts = new Map<string, number>()
      for (const row of data ?? []) for (const id of (row.tag_ids ?? []) as string[]) counts.set(id, (counts.get(id) ?? 0) + 1)
      return counts
    },
    retry: false,
  })

  const update = async (tag: Tag, patch: Partial<Pick<Tag, "name" | "color" | "is_important" | "is_active">>) => {
    const { error: err } = await createClient().from("tags").update(patch).eq("id", tag.id)
    if (err) {
      toast.error(err.code === "23505" ? "A tag with that name already exists" : err.message)
      return false
    }
    await queryClient.invalidateQueries({ queryKey: TAGS_KEY })
    return true
  }

  const add = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createTag(newName)
      setNewName("")
      toast.success("Tag added")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add tag")
    } finally {
      setAdding(false)
    }
  }

  const activeTags = tags.filter((t) => t.is_active)
  const retired = tags.filter((t) => !t.is_active)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <Link href="/admin" className="text-xs text-[#9090A8] hover:text-[#F0F0FA]">← Admin</Link>
        <h1 className="mt-1 flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Tags className="size-5 text-[#60A5FA]" /> Tags
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          One shared list for leads and universe contacts. Anyone can add a tag from the tag picker; here you rename,
          recolour, mark a tag <span className="text-[#F59E0B]">important</span> (shown on Kanban cards) or retire it.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New tag name"
          className="h-10 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={adding || !newName.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load tags — migration 020 may not have been run.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
            {activeTags.map((t) => (
              <TagRow key={t.id} tag={t} uses={usage.data?.get(t.id) ?? 0} onUpdate={update} />
            ))}
          </ul>

          {retired.length > 0 ? (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5A72]">Retired</h2>
              <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118] opacity-70">
                {retired.map((t) => (
                  <TagRow key={t.id} tag={t} uses={usage.data?.get(t.id) ?? 0} onUpdate={update} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function TagRow({
  tag,
  uses,
  onUpdate,
}: {
  tag: Tag
  uses: number
  onUpdate: (tag: Tag, patch: Partial<Pick<Tag, "name" | "color" | "is_important" | "is_active">>) => Promise<boolean>
}) {
  const [name, setName] = useState(tag.name)
  const [picking, setPicking] = useState(false)

  const saveName = async () => {
    const next = name.trim().replace(/\s+/g, " ")
    if (!next || next === tag.name) {
      setName(tag.name)
      return
    }
    if (!(await onUpdate(tag, { name: next }))) setName(tag.name)
  }

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-label="Change colour"
          className="size-6 shrink-0 rounded-full border-2 border-[#111118] ring-1 ring-[#3A3A52]"
          style={{ backgroundColor: tag.color }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-base text-[#F0F0FA] outline-none hover:border-[#2A2A3C] focus:border-[#3B82F6] focus:bg-[#1F1F2E] md:text-sm"
        />
        <span className="text-[11px] text-[#5A5A72]">{uses} lead{uses === 1 ? "" : "s"}</span>
        <button
          type="button"
          onClick={() => onUpdate(tag, { is_important: !tag.is_important })}
          title="Important tags show on Kanban cards"
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs transition",
            tag.is_important ? "border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#FBBF24]" : "border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]"
          )}
        >
          <Star className={cn("size-3.5", tag.is_important && "fill-current")} /> Important
        </button>
        <button
          type="button"
          onClick={() => onUpdate(tag, { is_active: !tag.is_active })}
          className="h-8 rounded-lg border border-[#2A2A3C] px-2 text-xs text-[#9090A8] hover:text-[#F0F0FA]"
        >
          {tag.is_active ? "Retire" : "Restore"}
        </button>
      </div>
      {picking ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={async () => {
                setPicking(false)
                await onUpdate(tag, { color: c })
              }}
              aria-label={`Colour ${c}`}
              className={cn("size-6 rounded-full", c === tag.color && "ring-2 ring-white")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : null}
    </li>
  )
}
