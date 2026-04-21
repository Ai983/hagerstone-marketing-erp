"use client"

import { create } from "zustand"

interface UIState {
  isSidebarCollapsed: boolean
  isLeadDrawerOpen: boolean
  leadDrawerId: string | null
  isNewLeadModalOpen: boolean
  isBulkImportModalOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setLeadDrawerOpen: (open: boolean) => void
  setLeadDrawerId: (id: string | null) => void
  openNewLeadModal: () => void
  closeNewLeadModal: () => void
  openBulkImportModal: () => void
  closeBulkImportModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  isLeadDrawerOpen: false,
  leadDrawerId: null,
  isNewLeadModalOpen: false,
  isBulkImportModalOpen: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setLeadDrawerOpen: (open) => set({ isLeadDrawerOpen: open }),
  setLeadDrawerId: (id) =>
    set({
      leadDrawerId: id,
      isLeadDrawerOpen: id !== null,
    }),
  openNewLeadModal: () => set({ isNewLeadModalOpen: true }),
  closeNewLeadModal: () => set({ isNewLeadModalOpen: false }),
  openBulkImportModal: () => set({ isBulkImportModalOpen: true }),
  closeBulkImportModal: () => set({ isBulkImportModalOpen: false }),
}))
