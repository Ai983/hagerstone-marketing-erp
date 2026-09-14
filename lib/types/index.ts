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
  email_opted_in?: boolean | null
  email_unsubscribed_at?: string | null
  email_unsubscribed_campaign?: string | null
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
  is_archived?: boolean
  archived_at?: string | null
  archived_by?: string | null
  /** Which body of data this lead came from — see `DataSet`. */
  data_set_id?: string | null
  data_set?: DataSet | null
  /** Field rating from whoever met the client. Not touched by scoring. */
  priority?: LeadPriority | null
  priority_note?: string | null
  priority_updated_at?: string | null
  /** Deal owner by name, for owners who have no ERP login yet. */
  owner_name?: string | null
  /** Identity in the source system, e.g. the founder's pipeline serial. */
  external_ref?: string | null
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
  media_url: string | null
  media_type: string | null
  outcome?: string
  duration_minutes?: number
  /** Meeting fields — where it happened, who was there, and when it took
   *  place (which can predate `created_at` if written up afterwards). */
  location?: string | null
  attendees?: string | null
  occurred_at?: string | null
  stage_from_id?: string
  stage_from?: PipelineStage
  stage_to_id?: string
  stage_to?: PipelineStage
  follow_up_at?: string
  follow_up_type?: string
  follow_up_completed: boolean
  is_automated: boolean
  data_set_id?: string | null
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

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  actor_id: string | null
  actor_type: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_values: Record<string, any> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_values: Record<string, any> | null
  ip_address: string | null
  created_at: string
  actor?: {
    id: string
    full_name: string
    role: string
  }
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

// ------------------------------------------------------------------
// Data provenance, contact universe, document library
// ------------------------------------------------------------------

export type LeadPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'dropped'

export type DataSetKind =
  | 'erp_native' | 'field_meetings' | 'founder_pipeline'
  | 'founder_universe' | 'import' | 'other'

/** A body of data with one origin — "Architect Drive", "Founder Pipeline"… */
export interface DataSet {
  id: string
  key: string
  name: string
  description: string | null
  kind: DataSetKind
  color: string
  icon: string | null
  source_file: string | null
  source_note: string | null
  record_count: number
  imported_at: string | null
  is_active: boolean
  position: number
}

export type FunnelStage =
  | '1-AUDIENCE' | '2-CONTACTED' | '3-ENGAGED' | '4-OPPORTUNITY' | '5-CLIENT'

export interface UniverseContact {
  id: string
  serial: string | null
  name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  city: string | null
  funnel_stage: FunnelStage
  persona: string | null
  field: string | null
  region: string | null
  recency: string | null
  project: string | null
  suggested_action: string | null
  source_tag: string | null
  notes: string | null
  data_set_id: string | null
  converted_lead_id: string | null
  converted_at: string | null
  is_lead: boolean
  created_at: string
}

export type DocumentCategory =
  | 'company_profile' | 'sales_pitch' | 'case_study' | 'brochure'
  | 'presentation' | 'rate_card' | 'certificate' | 'project_photos' | 'other'

export interface CompanyDocument {
  id: string
  title: string
  description: string | null
  category: DocumentCategory
  service_line: ServiceLine | 'all'
  file_name: string
  file_path: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  version: string
  is_current: boolean
  tags: string[]
  visible_to_roles: UserRole[]
  download_count: number
  share_count: number
  is_active: boolean
  uploaded_by: string | null
  uploader?: { full_name: string } | null
  created_at: string
  updated_at: string
}
