"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"

export const DATA_HEALTH_KEY = ["data-health"] as const

export interface HealthLead {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  phone_tail: string | null
  email: string | null
  city: string | null
  service_line: string | null
  estimated_budget: string | null
  proposal_estimated_cost: number | null
  final_agreed_price: number | null
  closure_value: number | null
  priority: string | null
  data_set_id: string | null
  created_at: string
  stage: { slug: string; name: string; color: string; stage_type: string } | null
}

/** The five things a usable lead needs. */
export const HEALTH_CHECKS = [
  { key: "reachable", label: "Phone or email", test: (l: HealthLead) => Boolean(l.phone_tail || l.email?.trim()) },
  { key: "company", label: "Company", test: (l: HealthLead) => Boolean(l.company_name?.trim()) },
  { key: "city", label: "City", test: (l: HealthLead) => Boolean(l.city?.trim()) },
  { key: "service", label: "Service line", test: (l: HealthLead) => Boolean(l.service_line && l.service_line !== "unknown") },
  {
    key: "value",
    label: "Budget / value",
    test: (l: HealthLead) =>
      Boolean(l.estimated_budget?.trim() || l.proposal_estimated_cost || l.final_agreed_price || l.closure_value),
  },
] as const

export type HealthCheckKey = (typeof HEALTH_CHECKS)[number]["key"]

export function missingChecks(l: HealthLead): HealthCheckKey[] {
  return HEALTH_CHECKS.filter((c) => !c.test(l)).map((c) => c.key)
}

/** 0–100: the share of the five checks that pass, averaged over leads. */
export function healthScore(leads: HealthLead[]) {
  if (!leads.length) return 100
  let passed = 0
  for (const l of leads) passed += HEALTH_CHECKS.length - missingChecks(l).length
  return Math.round((passed / (leads.length * HEALTH_CHECKS.length)) * 100)
}

export interface DuplicateGroup {
  key: string
  matchedOn: "phone" | "email"
  value: string
  leads: HealthLead[]
}

/**
 * Open leads for the Data Health page, plus the derived duplicate groups
 * (same last-10-digit phone, or same email ignoring case).
 */
export function useDataHealth() {
  const query = useQuery({
    queryKey: [...DATA_HEALTH_KEY, "leads"],
    queryFn: async (): Promise<HealthLead[]> => {
      const { data, error } = await createClient()
        .from("leads")
        .select(
          "id, full_name, company_name, phone, phone_tail, email, city, service_line, estimated_budget, proposal_estimated_cost, final_agreed_price, closure_value, priority, data_set_id, created_at, stage:stage_id(slug, name, color, stage_type)"
        )
        .eq("is_archived", false)
        .limit(10000)
      if (error) throw error
      return (data ?? []) as unknown as HealthLead[]
    },
  })

  const duplicates = useMemo<DuplicateGroup[]>(() => {
    const leads = query.data ?? []
    const byPhone = new Map<string, HealthLead[]>()
    const byEmail = new Map<string, HealthLead[]>()
    for (const l of leads) {
      if (l.phone_tail) byPhone.set(l.phone_tail, [...(byPhone.get(l.phone_tail) ?? []), l])
      const email = l.email?.trim().toLowerCase()
      if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), l])
    }
    const groups: DuplicateGroup[] = []
    const seen = new Set<string>()
    const add = (matchedOn: "phone" | "email", value: string, list: HealthLead[]) => {
      if (list.length < 2) return
      // Same set of leads already listed via the other field — show once.
      const sig = list.map((l) => l.id).sort().join("|")
      if (seen.has(sig)) return
      seen.add(sig)
      groups.push({ key: `${matchedOn}:${value}`, matchedOn, value, leads: list })
    }
    byPhone.forEach((list, tail) => add("phone", tail, list))
    byEmail.forEach((list, email) => add("email", email, list))
    return groups
  }, [query.data])

  return { ...query, leads: query.data ?? [], duplicates }
}

export interface UniverseMatch {
  lead_id: string
  universe_contact_id: string
  universe_name: string | null
  universe_company: string | null
  funnel_stage: string
  matched_on: "phone" | "email"
}

/** Open leads that exist in the universe but were never linked to it. */
export function useUniverseMatches() {
  return useQuery({
    queryKey: [...DATA_HEALTH_KEY, "universe-matches"],
    queryFn: async (): Promise<UniverseMatch[]> => {
      const { data, error } = await createClient().rpc("lead_universe_matches")
      if (error) throw error
      return (data ?? []) as UniverseMatch[]
    },
    retry: false,
  })
}

export function useUniverseHealth() {
  return useQuery({
    queryKey: [...DATA_HEALTH_KEY, "universe-summary"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("universe_health_summary")
      if (error) throw error
      const row = (data ?? [])[0] as
        | { total: number; unreachable: number; phone_duplicate_groups: number; contacts_in_duplicate_groups: number }
        | undefined
      return row
        ? {
            total: Number(row.total),
            unreachable: Number(row.unreachable),
            duplicateGroups: Number(row.phone_duplicate_groups),
            inDuplicateGroups: Number(row.contacts_in_duplicate_groups),
          }
        : null
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}
