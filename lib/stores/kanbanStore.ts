"use client"

import { create } from "zustand"

import type { LeadSource, PipelineStage, ServiceLine } from "@/lib/types"
import type { KanbanLead } from "@/lib/hooks/useKanban"

export interface KanbanFiltersState {
  myLeadsOnly: boolean
  overdueOnly: boolean
  serviceLines: ServiceLine[]
  sources: LeadSource[]
  assignedTo: string[]
}

export interface PendingStageChange {
  leadId: string
  fromStageId: string
  toStageId: string
}

interface KanbanStoreState {
  leads: KanbanLead[]
  stages: PipelineStage[]
  filters: KanbanFiltersState
  selectedLeadId: string | null
  pendingStageChange: PendingStageChange | null
  setLeads: (leads: KanbanLead[]) => void
  setStages: (stages: PipelineStage[]) => void
  updateLead: (lead: KanbanLead) => void
  addLead: (lead: KanbanLead) => void
  moveLeadToStage: (leadId: string, newStageId: string) => void
  revertLeadStage: (leadId: string, originalStageId: string) => void
  setFilter: <K extends keyof KanbanFiltersState>(
    key: K,
    value: KanbanFiltersState[K]
  ) => void
  clearFilters: () => void
  setSelectedLeadId: (id: string | null) => void
  setPendingStageChange: (change: PendingStageChange | null) => void
  clearPendingStageChange: () => void
}

const defaultFilters: KanbanFiltersState = {
  myLeadsOnly: false,
  overdueOnly: false,
  serviceLines: [],
  sources: [],
  assignedTo: [],
}

export const useKanbanStore = create<KanbanStoreState>((set) => ({
  leads: [],
  stages: [],
  filters: defaultFilters,
  selectedLeadId: null,
  pendingStageChange: null,
  setLeads: (leads) => set({ leads }),
  setStages: (stages) => set({ stages }),
  updateLead: (lead) =>
    set((state) => ({
      leads: state.leads.map((item) => (item.id === lead.id ? lead : item)),
    })),
  addLead: (lead) =>
    set((state) => ({
      leads: [lead, ...state.leads],
    })),
  moveLeadToStage: (leadId, newStageId) =>
    set((state) => {
      const nextStage = state.stages.find((stage) => stage.id === newStageId) ?? null

      return {
        leads: state.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                stage_id: newStageId,
                stage: nextStage,
              }
            : lead
        ),
      }
    }),
  revertLeadStage: (leadId, originalStageId) =>
    set((state) => {
      const originalStage = state.stages.find((stage) => stage.id === originalStageId) ?? null

      return {
        leads: state.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                stage_id: originalStageId,
                stage: originalStage,
              }
            : lead
        ),
      }
    }),
  setFilter: (key, value) => {
    console.log("[kanbanStore] setFilter:", key, value)
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }))
  },
  clearFilters: () =>
    set({
      filters: {
        myLeadsOnly: false,
        overdueOnly: false,
        serviceLines: [],
        sources: [],
        assignedTo: [],
      },
    }),
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
  setPendingStageChange: (change) => set({ pendingStageChange: change }),
  clearPendingStageChange: () => set({ pendingStageChange: null }),
}))
