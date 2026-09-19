"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { Tag } from "@/lib/types"

export const TAGS_KEY = ["tags"] as const

// New tags cycle through these so the list stays readable.
const NEW_TAG_COLORS = ["#60A5FA", "#34D399", "#C084FC", "#FBBF24", "#F472B6", "#2DD4BF", "#FB923C", "#A3E635"]

/**
 * The shared tag list (migration 020), cached for the session like
 * useDataSets. `byId` resolves the ids stored on leads and contacts;
 * `active` is what the picker offers.
 */
export function useTags() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: TAGS_KEY,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await createClient()
        .from("tags")
        .select("id, name, color, is_important, is_active, position")
        .order("position")
        .order("name")
      if (error) throw error
      return (data ?? []) as Tag[]
    },
    staleTime: 10 * 60 * 1000,
    // Before migration 020 there is no tags table — pages must still load.
    retry: false,
  })

  const { tags, active, byId } = useMemo(() => {
    const list = query.data ?? []
    return {
      tags: list,
      active: list.filter((t) => t.is_active),
      byId: new Map(list.map((t) => [t.id, t])),
    }
  }, [query.data])

  /**
   * Add a tag to the shared list, or return the existing one when the
   * name matches ignoring case — so "vip" never becomes a second "VIP".
   */
  const createTag = async (rawName: string): Promise<Tag> => {
    const name = rawName.trim().replace(/\s+/g, " ")
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!existing.is_active) {
        await createClient().from("tags").update({ is_active: true }).eq("id", existing.id)
        await queryClient.invalidateQueries({ queryKey: TAGS_KEY })
      }
      return existing
    }

    const user = await getCachedUser()
    const { data, error } = await createClient()
      .from("tags")
      .insert({
        name,
        color: NEW_TAG_COLORS[tags.length % NEW_TAG_COLORS.length],
        position: 1000 + tags.length,
        created_by: user?.id ?? null,
      })
      .select("id, name, color, is_important, is_active, position")
      .single()
    if (error) {
      // Someone else created the same name a moment ago (unique index).
      if (error.code === "23505") {
        await queryClient.invalidateQueries({ queryKey: TAGS_KEY })
        const { data: again } = await createClient()
          .from("tags")
          .select("id, name, color, is_important, is_active, position")
          .ilike("name", name)
          .maybeSingle()
        if (again) return again as Tag
      }
      throw error
    }
    await queryClient.invalidateQueries({ queryKey: TAGS_KEY })
    return data as Tag
  }

  return { ...query, tags, active, byId, createTag }
}
