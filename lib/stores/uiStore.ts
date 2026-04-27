"use client"

import { create } from "zustand"

interface UIState {
  isSidebarCollapsed: boolean
  isMobileNavOpen: boolean
  isLeadDrawerOpen: boolean
  leadDrawerId: string | null
  isNewLeadModalOpen: boolean
  isBulkImportModalOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  openMobileNav: () => void
  closeMobileNav: () => void
  toggleMobileNav: () => void
  setLeadDrawerOpen: (open: boolean) => void
  setLeadDrawerId: (id: string | null) => void
  openNewLeadModal: () => void
  closeNewLeadModal: () => void
  openBulkImportModal: () => void
  closeBulkImportModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  isLeadDrawerOpen: false,
  leadDrawerId: null,
  isNewLeadModalOpen: false,
  isBulkImportModalOpen: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  toggleMobileNav: () =>
    set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
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
