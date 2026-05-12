"use client"

import { create } from "zustand"

interface UIState {
  isSidebarCollapsed: boolean
  isMobileNavOpen: boolean
  isMobileSidebarOpen: boolean
  isLeadDrawerOpen: boolean
  leadDrawerId: string | null
  drawerActiveTab: string | null
  drawerOpenLogCall: boolean
  isNewLeadModalOpen: boolean
  isBulkImportModalOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  openMobileNav: () => void
  closeMobileNav: () => void
  toggleMobileNav: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setLeadDrawerOpen: (open: boolean) => void
  setLeadDrawerId: (id: string | null) => void
  setDrawerActiveTab: (tab: string | null) => void
  setDrawerOpenLogCall: (open: boolean) => void
  openNewLeadModal: () => void
  closeNewLeadModal: () => void
  openBulkImportModal: () => void
  closeBulkImportModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  isMobileSidebarOpen: false,
  isLeadDrawerOpen: false,
  leadDrawerId: null,
  drawerActiveTab: null,
  drawerOpenLogCall: false,
  isNewLeadModalOpen: false,
  isBulkImportModalOpen: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  toggleMobileNav: () =>
    set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  setLeadDrawerOpen: (open) => set({ isLeadDrawerOpen: open }),
  setLeadDrawerId: (id) =>
    set({
      leadDrawerId: id,
      isLeadDrawerOpen: id !== null,
    }),
  setDrawerActiveTab: (tab) => set({ drawerActiveTab: tab }),
  setDrawerOpenLogCall: (open) => set({ drawerOpenLogCall: open }),
  openNewLeadModal: () => set({ isNewLeadModalOpen: true }),
  closeNewLeadModal: () => set({ isNewLeadModalOpen: false }),
  openBulkImportModal: () => set({ isBulkImportModalOpen: true }),
  closeBulkImportModal: () => set({ isBulkImportModalOpen: false }),
}))
