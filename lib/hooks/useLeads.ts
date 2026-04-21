"use client"

import type { Lead, PipelineStage, Profile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"

export interface DuplicateLeadMatch {
  id: string
  full_name: string
  company_name?: string | null
  phone?: string | null
  phone_alt?: string | null
  stage?: Pick<PipelineStage, "id" | "name" | "slug"> | null
}

export interface CreateLeadInput {
  full_name: string
  phone: string
  phone_alt?: string
  email?: string
  designation?: string
  company_name?: string
  company_size?: string
  industry?: string
  city?: string
  state?: string
  service_line?: string
  estimated_budget?: string
  project_size_sqft?: number
  expected_timeline?: string
  source: string
  referral_name?: string
  whatsapp_opted_in: boolean
  initial_notes?: string
  stage_id: string
  created_by: string
  assigned_to: string
}

export interface LeadListItem extends Omit<Lead, "stage" | "assignee"> {
  stage?: Pick<PipelineStage, "id" | "name" | "slug" | "color"> | null
  assignee?: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function useLeads() {
  const getLeads = async (): Promise<LeadListItem[]> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("leads")
      .select("*, stage:stage_id(id, name, slug, color), assignee:assigned_to(id, full_name, avatar_url, role)")
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return (data ?? []) as LeadListItem[]
  }

  const checkDuplicate = async (phone: string): Promise<DuplicateLeadMatch | null> => {
    const supabase = createClient()
    const normalizedPhone = phone.trim()

    const { data, error } = await supabase
      .from("leads")
      .select("id, full_name, company_name, phone, phone_alt, stage:stage_id(id, name, slug)")
      .or(`phone.eq.${normalizedPhone},phone_alt.eq.${normalizedPhone}`)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as DuplicateLeadMatch | null
  }

  const getStageBySlug = async (slug: string): Promise<PipelineStage | null> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as PipelineStage | null
  }

  const getStages = async (): Promise<PipelineStage[]> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .order("position", { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as PipelineStage[]
  }

  const createLead = async (data: CreateLeadInput): Promise<Lead> => {
    const supabase = createClient()

    const payload = {
      ...data,
      full_name: data.full_name.trim(),
      phone: data.phone.trim(),
      phone_alt: normalizeOptionalString(data.phone_alt),
      email: normalizeOptionalString(data.email),
      designation: normalizeOptionalString(data.designation),
      company_name: normalizeOptionalString(data.company_name),
      company_size: normalizeOptionalString(data.company_size),
      industry: normalizeOptionalString(data.industry),
      city: normalizeOptionalString(data.city),
      state: normalizeOptionalString(data.state) ?? "Delhi NCR",
      service_line: normalizeOptionalString(data.service_line),
      estimated_budget: normalizeOptionalString(data.estimated_budget),
      project_size_sqft: data.project_size_sqft,
      expected_timeline: normalizeOptionalString(data.expected_timeline),
      source: data.source,
      referral_name: normalizeOptionalString(data.referral_name),
      whatsapp_opted_in: data.whatsapp_opted_in,
      whatsapp_opted_in_at: data.whatsapp_opted_in ? new Date().toISOString() : null,
      initial_notes: normalizeOptionalString(data.initial_notes),
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert(payload)
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return lead as Lead
  }

  const getLeadById = async (id: string): Promise<Lead | null> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("leads")
      .select("*, stage:stage_id(*)")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as Lead | null
  }

  const getCurrentProfile = async (): Promise<Profile | null> => {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return null
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as Profile | null
  }

  const getTeamMembers = async (): Promise<Profile[]> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, avatar_url, is_active, created_at")
      .eq("is_active", true)
      .order("full_name", { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as Profile[]
  }

  const getOverdueLeadIds = async (): Promise<string[]> => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tasks")
      .select("lead_id")
      .eq("is_overdue", true)

    if (error) {
      throw error
    }

    return Array.from(new Set((data ?? []).map((task) => task.lead_id).filter(Boolean)))
  }

  return {
    getLeads,
    createLead,
    checkDuplicate,
    getLeadById,
    getStageBySlug,
    getStages,
    getCurrentProfile,
    getTeamMembers,
    getOverdueLeadIds,
  }
}
