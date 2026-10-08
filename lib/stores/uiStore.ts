"use client"

import { create } from "zustand"

export interface NewLeadPrefill {
  full_name?: string
  phone?: string
  initial_notes?: string
}

interface UIState {
  isSidebarCollapsed: boolean
  isMobileNavOpen: boolean
  isMobileSidebarOpen: boolean
  isLeadDrawerOpen: boolean
  leadDrawerId: string | null
  drawerActiveTab: string | null
  drawerOpenLogCall: boolean
  /** Open the drawer straight into Log Meeting — the phone quick action. */
  drawerOpenLogMeeting: boolean
  isNewLeadModalOpen: boolean
  /** Fields to start the New Lead form with (e.g. a number Runo called). */
  newLeadPrefill: NewLeadPrefill | null
  isBulkImportModalOpen: boolean
  /** Hides the sidebar and top bar so a page (the pipeline) gets the whole screen. */
  isFocusMode: boolean
  setFocusMode: (on: boolean) => void
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
  setDrawerOpenLogMeeting: (open: boolean) => void
  openNewLeadModal: () => void
  /** Kept separate from openNewLeadModal, which is passed straight to onClick. */
  openNewLeadModalWith: (prefill: NewLeadPrefill) => void
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
  drawerOpenLogMeeting: false,
  isNewLeadModalOpen: false,
  newLeadPrefill: null,
  isBulkImportModalOpen: false,
  isFocusMode: false,
  setFocusMode: (on) => set({ isFocusMode: on }),
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
  setDrawerOpenLogMeeting: (open) => set({ drawerOpenLogMeeting: open }),
  openNewLeadModal: () => set({ isNewLeadModalOpen: true, newLeadPrefill: null }),
  openNewLeadModalWith: (prefill) => set({ isNewLeadModalOpen: true, newLeadPrefill: prefill }),
  closeNewLeadModal: () => set({ isNewLeadModalOpen: false, newLeadPrefill: null }),
  openBulkImportModal: () => set({ isBulkImportModalOpen: true }),
  closeBulkImportModal: () => set({ isBulkImportModalOpen: false }),
}))
