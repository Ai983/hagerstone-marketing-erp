"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"
import type { DataSet } from "@/lib/types"

/**
 * The data sets (Architect Drive, Founder Pipeline…). They change only
 * on import, so this is cached for the session rather than refetched
 * per page.
 */
export function useDataSets() {
  const query = useQuery({
    queryKey: ["data-sets"],
    queryFn: async (): Promise<DataSet[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("data_sets")
        .select("*")
        .eq("is_active", true)
        .order("position")
      if (error) throw error
      return (data ?? []) as DataSet[]
    },
    staleTime: 10 * 60 * 1000,
  })

  // Memoised so callers can put these in hook dependency lists.
  const { byId, byKey, dataSets } = useMemo(() => {
    const list = query.data ?? []
    return {
      dataSets: list,
      byId: new Map(list.map((d) => [d.id, d])),
      byKey: new Map(list.map((d) => [d.key, d])),
    }
  }, [query.data])

  return { ...query, dataSets, byId, byKey }
}
