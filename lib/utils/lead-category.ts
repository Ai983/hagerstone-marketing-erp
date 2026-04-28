export const categoryConfig = {
  hot: { label: "Hot", bg: "#7F1D1D", color: "#FCA5A5" },
  warm: { label: "Warm", bg: "#78350F", color: "#FCD34D" },
  lukewarm: { label: "Lukewarm", bg: "#1E3A5F", color: "#93C5FD" },
  cold: { label: "Cold", bg: "#1F2937", color: "#9CA3AF" },
} as const

export type LeadCategory = keyof typeof categoryConfig
