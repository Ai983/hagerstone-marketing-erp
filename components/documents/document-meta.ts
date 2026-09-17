import type { DocumentCategory } from "@/lib/types"

export const DOCUMENT_BUCKET = "boq-documents"
/** Folder inside the bucket. The bucket is shared with BOQ uploads. */
export const DOCUMENT_FOLDER = "company-documents"

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  company_profile: "Company Profile",
  sales_pitch: "Sales Pitch",
  case_study: "Case Study",
  brochure: "Brochure",
  presentation: "Presentation",
  rate_card: "Rate Card",
  certificate: "Certificate",
  project_photos: "Project Photos",
  other: "Other",
}

export const CATEGORY_ORDER: DocumentCategory[] = [
  "company_profile", "sales_pitch", "case_study", "brochure",
  "presentation", "project_photos", "certificate", "rate_card", "other",
]

export const SERVICE_LINE_LABELS: Record<string, string> = {
  all: "All services",
  office_interiors: "Office Interiors",
  mep: "MEP",
  facade_glazing: "Facade & Glazing",
  peb_construction: "PEB Construction",
  civil_works: "Civil Works",
  multiple: "Multiple",
}

// The system has two roles and both have full access.
export const UPLOAD_ROLES = ["admin", "sales_head"]
export const DELETE_ROLES = ["admin", "sales_head"]

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Public URL that makes the browser save the file under its real name. */
export function downloadUrl(fileUrl: string, fileName: string) {
  const sep = fileUrl.includes("?") ? "&" : "?"
  return `${fileUrl}${sep}download=${encodeURIComponent(fileName)}`
}
