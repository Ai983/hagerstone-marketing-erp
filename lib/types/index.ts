export type UserRole = 'admin' | 'manager' | 'sales_rep' | 'marketing' | 'founder'

export type ServiceLine =
  | 'office_interiors' | 'mep' | 'facade_glazing'
  | 'peb_construction' | 'civil_works' | 'multiple' | 'unknown'

export type LeadSource =
  | 'website' | 'manual_sales' | 'whatsapp_inbound'
  | 'referral' | 'google_ads' | 'linkedin' | 'justdial'
  | 'ai_suggested' | 'other'

export type StageType = 'active' | 'won' | 'lost' | 'on_hold' | 'reengagement'

export type InteractionType =
  | 'call_outbound' | 'call_inbound' | 'call_missed'
  | 'whatsapp_sent' | 'whatsapp_received'
  | 'email_sent' | 'email_received'
  | 'site_visit' | 'meeting'
  | 'note' | 'stage_change' | 'assignment_change'
  | 'campaign_enrolled' | 'campaign_message_sent' | 'campaign_responded'
  | 'lead_created' | 'ai_suggestion_generated'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: UserRole
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface PipelineStage {
  id: string
  name: string
  slug: string
  color: string
  position: number
  is_terminal: boolean
  requires_note: boolean
  requires_value: boolean
  stage_type: StageType
}

export interface Lead {
  id: string
  full_name: string
  email?: string
  phone?: string
  phone_alt?: string
  designation?: string
  company_name?: string
  company_size?: string
  industry?: string
  city?: string
  state?: string
  service_line?: ServiceLine
  estimated_budget?: string
  project_size_sqft?: number
  expected_timeline?: string
  stage_id: string
  stage?: PipelineStage
  stage_entered_at: string
  assigned_to?: string
  assignee?: Profile
  created_by?: string
  source: LeadSource
  source_detail?: string
  utm_source?: string
  utm_campaign?: string
  whatsapp_opted_in: boolean
  score: number
  category: "hot" | "warm" | "lukewarm" | "cold" | null
  category_remarks: string | null
  category_updated_at: string | null
  category_updated_by: string | null
  boq_received_date: string | null
  boq_document_url: string | null
  boq_deadline: string | null
  boq_scope: string | null
  boq_area_sqft: number | null
  boq_floors: number | null
  boq_remarks: string | null
  boq_received_by: string | null
  proposal_pdf_url: string | null
  proposal_estimated_cost: number | null
  proposal_sent_date: string | null
  proposal_deadline: string | null
  proposal_validity_days: number | null
  proposal_remarks: string | null
  proposal_sent_by: string | null
  final_boq_url: string | null
  final_agreed_price: number | null
  final_area_sqft: number | null
  final_floors: number | null
  final_scope: string | null
  final_remarks: string | null
  won_date: string | null
  won_by: string | null
  closure_reason?: string
  closure_value?: number
  closed_at?: string
  initial_notes?: string
  is_sample_data: boolean
  created_at: string
  updated_at: string
  // Computed
  interactions?: Interaction[]
  tasks?: Task[]
  next_task?: {
    due_at: string
    type: string
    title: string
  } | null
  stage_age_days?: number
}

export interface PriceRevision {
  id: string
  lead_id: string
  revised_price: number
  revision_note: string | null
  revised_by: string | null
  created_at: string
  profile?: { full_name: string }
}

export interface Interaction {
  id: string
  lead_id: string
  user_id?: string
  user?: Profile
  type: InteractionType
  title?: string
  notes?: string
  outcome?: string
  duration_minutes?: number
  stage_from_id?: string
  stage_from?: PipelineStage
  stage_to_id?: string
  stage_to?: PipelineStage
  follow_up_at?: string
  follow_up_type?: string
  follow_up_completed: boolean
  is_automated: boolean
  created_at: string
}

export interface Task {
  id: string
  lead_id: string
  lead?: Lead
  assigned_to: string
  assignee?: Profile
  title: string
  description?: string
  type: string
  due_at: string
  completed_at?: string
  is_overdue: boolean
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  type: string
  status: string
  created_by?: string
  audience_count: number
  total_sent: number
  total_delivered: number
  total_replies: number
  total_converted: number
  starts_at?: string
  ends_at?: string
  last_sent_at: string | null
  created_at: string
}

// Kanban board state
export interface KanbanColumn {
  stage: PipelineStage
  leads: Lead[]
}

// Filters
export interface LeadFilters {
  assignedTo?: string[]
  stages?: string[]
  sources?: string[]
  serviceLines?: ServiceLine[]
  cities?: string[]
  dateFrom?: string
  dateTo?: string
  searchQuery?: string
  staleOnly?: boolean
  overdueOnly?: boolean
}
