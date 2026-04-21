"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"

// ── Constants ───────────────────────────────────────────────────────

const ALLOWED_SERVICE_LINES = new Set([
  "office_interiors",
  "mep",
  "facade_glazing",
  "peb_construction",
  "civil_works",
  "multiple",
  "unknown",
])

const ALLOWED_SOURCES = new Set([
  "website",
  "manual_sales",
  "whatsapp_inbound",
  "referral",
  "google_ads",
  "linkedin",
  "justdial",
  "other",
])

const HEADER_ROW = [
  "Full Name*",
  "Phone*",
  "Email",
  "Company Name",
  "City",
  "Service Line",
  "Estimated Budget",
  "Source",
  "WhatsApp Opted In",
  "Initial Notes",
]

const EXAMPLE_ROW = [
  "Rajesh Sharma",
  "9876543210",
  "rajesh@company.com",
  "TechCorp India",
  "Noida",
  "office_interiors",
  "₹50L - ₹1Cr",
  "referral",
  "yes",
  "Interested in open plan layout",
]

// ── Helpers ─────────────────────────────────────────────────────────

function generateTemplate() {
  const rows: (string | number)[][] = [
    HEADER_ROW,
    EXAMPLE_ROW,
    ...Array.from({ length: 20 }, () => Array(HEADER_ROW.length).fill("")),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths for readability
  ws["!cols"] = [
    { wch: 20 }, // Full Name
    { wch: 16 }, // Phone
    { wch: 26 }, // Email
    { wch: 22 }, // Company
    { wch: 14 }, // City
    { wch: 18 }, // Service Line
    { wch: 18 }, // Budget
    { wch: 14 }, // Source
    { wch: 18 }, // WhatsApp Opted In
    { wch: 40 }, // Notes
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Leads")
  XLSX.writeFile(wb, "Hagerstone_Lead_Import_Template.xlsx")
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  return digits
}

function parseYesNo(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value !== "string") return false
  const v = value.trim().toLowerCase()
  return v === "yes" || v === "true" || v === "1" || v === "y"
}

// ── Parsed row type ─────────────────────────────────────────────────

type RowStatus = "valid" | "error" | "duplicate"

interface ParsedRow {
  row: number // 1-based spreadsheet row number
  full_name: string
  phone: string
  email: string | null
  company_name: string | null
  city: string | null
  service_line: string | null
  estimated_budget: string | null
  source: string
  whatsapp_opted_in: boolean
  initial_notes: string | null
  status: RowStatus
  error?: string
}

function parseWorkbook(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) return reject(new Error("Empty file"))
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) return reject(new Error("Workbook has no sheets"))
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/\*/g, "").replace(/[\s_-]+/g, "_").trim()
}

function getField(row: Record<string, unknown>, target: string): string {
  const targetNorm = normaliseKey(target)
  for (const key of Object.keys(row)) {
    if (normaliseKey(key) === targetNorm) {
      const v = row[key]
      if (v == null) return ""
      return String(v).trim()
    }
  }
  return ""
}

async function fetchExistingPhones(): Promise<Set<string>> {
  const supabase = createClient()
  const { data } = await supabase.from("leads").select("phone, phone_alt")
  const set = new Set<string>()
  for (const r of data ?? []) {
    if (r.phone) set.add(normalizePhone(String(r.phone)))
    if (r.phone_alt) set.add(normalizePhone(String(r.phone_alt)))
  }
  return set
}

async function validateRows(raw: Record<string, unknown>[]): Promise<ParsedRow[]> {
  const existingPhones = await fetchExistingPhones()
  const seenInFile = new Set<string>()
  const results: ParsedRow[] = []

  raw.forEach((row, idx) => {
    const fullName = getField(row, "Full Name")
    const phone = getField(row, "Phone")
    const email = getField(row, "Email")
    const companyName = getField(row, "Company Name")
    const city = getField(row, "City")
    const serviceLine = getField(row, "Service Line")
    const estimatedBudget = getField(row, "Estimated Budget")
    const source = getField(row, "Source") || "manual_sales"
    const whatsappOptedIn = parseYesNo(getField(row, "WhatsApp Opted In"))
    const initialNotes = getField(row, "Initial Notes")

    // Skip the template example row exactly as shipped
    if (
      fullName === EXAMPLE_ROW[0] &&
      phone === EXAMPLE_ROW[1] &&
      email === EXAMPLE_ROW[2]
    ) {
      return
    }

    // Skip fully empty rows
    if (!fullName && !phone && !email && !companyName) return

    // sheet_to_json skips blank rows but still assigns based on original
    // position — we use idx + 2 since header is row 1 and data starts row 2
    const rowNum = idx + 2

    // Validation
    let status: RowStatus = "valid"
    let error: string | undefined

    if (!fullName) {
      status = "error"
      error = "Missing Full Name"
    } else if (!phone) {
      status = "error"
      error = "Missing Phone"
    } else if (serviceLine && !ALLOWED_SERVICE_LINES.has(serviceLine)) {
      status = "error"
      error = `Invalid Service Line. Allowed: ${Array.from(ALLOWED_SERVICE_LINES).join(", ")}`
    } else if (source && !ALLOWED_SOURCES.has(source)) {
      status = "error"
      error = `Invalid Source. Allowed: ${Array.from(ALLOWED_SOURCES).join(", ")}`
    }

    if (status === "valid") {
      const norm = normalizePhone(phone)
      if (norm.length < 7) {
        status = "error"
        error = "Phone number is too short"
      } else if (existingPhones.has(norm) || seenInFile.has(norm)) {
        status = "duplicate"
        error = existingPhones.has(norm)
          ? "Already exists in database"
          : "Duplicate within this file"
      } else {
        seenInFile.add(norm)
      }
    }

    results.push({
      row: rowNum,
      full_name: fullName,
      phone,
      email: email || null,
      company_name: companyName || null,
      city: city || null,
      service_line: serviceLine || null,
      estimated_budget: estimatedBudget || null,
      source,
      whatsapp_opted_in: whatsappOptedIn,
      initial_notes: initialNotes || null,
      status,
      error,
    })
  })

  return results
}

// ── Component ───────────────────────────────────────────────────────

export function BulkImportModal() {
  const { isBulkImportModalOpen, closeBulkImportModal } = useUIStore()
  const queryClient = useQueryClient()

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<
    { imported: number; skipped: number; errors: number } | null
  >(null)
  const [dragActive, setDragActive] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state whenever the modal opens/closes
  useEffect(() => {
    if (!isBulkImportModalOpen) {
      setFile(null)
      setRows([])
      setImporting(false)
      setImportResult(null)
      setParsing(false)
    }
  }, [isBulkImportModalOpen])

  // Body scroll lock + Esc to close
  useEffect(() => {
    if (!isBulkImportModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !importing) closeBulkImportModal()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [isBulkImportModalOpen, importing, closeBulkImportModal])

  const handleFile = async (f: File) => {
    setFile(f)
    setRows([])
    setImportResult(null)
    setParsing(true)
    try {
      const raw = await parseWorkbook(f)
      const validated = await validateRows(raw)
      setRows(validated)
      if (validated.length === 0) {
        toast.error("No data rows found in the file")
      } else {
        const valid = validated.filter((r) => r.status === "valid").length
        toast.success(`Parsed ${validated.length} rows · ${valid} valid`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFile(dropped)
  }

  const handleImport = async () => {
    const valid = rows.filter((r) => r.status === "valid")
    if (valid.length === 0) {
      toast.error("No valid rows to import")
      return
    }
    setImporting(true)
    try {
      const res = await fetch("/api/leads/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: valid.map((r) => ({
            row: r.row,
            full_name: r.full_name,
            phone: r.phone,
            email: r.email,
            company_name: r.company_name,
            city: r.city,
            service_line: r.service_line,
            estimated_budget: r.estimated_budget,
            source: r.source,
            whatsapp_opted_in: r.whatsapp_opted_in,
            initial_notes: r.initial_notes,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed")

      setImportResult({
        imported: data.imported ?? 0,
        skipped: (data.skipped ?? []).length,
        errors: (data.errors ?? []).length,
      })

      toast.success(
        `Successfully imported ${data.imported} lead${data.imported === 1 ? "" : "s"}`
      )

      // Refresh every view that shows leads
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["inbox-leads"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  // Counts
  const validCount = rows.filter((r) => r.status === "valid").length
  const errorCount = rows.filter((r) => r.status === "error").length
  const dupCount = rows.filter((r) => r.status === "duplicate").length

  return (
    <AnimatePresence>
      {isBulkImportModalOpen && (
        <>
          <motion.div
            key="bulk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !importing && closeBulkImportModal()}
            className="fixed inset-0 z-[60] bg-black/70"
          />

          <motion.div
            key="bulk-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto p-10"
            style={{ pointerEvents: "none" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
              style={{ pointerEvents: "auto" }}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A3C] bg-[#0F0F15] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
                    <Upload className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA]">
                      Bulk Import Leads
                    </h2>
                    <p className="text-[11px] text-[#9090A8]">
                      Upload an Excel file to add many leads at once.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !importing && closeBulkImportModal()}
                  disabled={importing}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA] disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
                {/* Step 1: Template download */}
                <section className="rounded-xl border border-[#2A2A3C] bg-[#0F0F15] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9090A8]">
                        Step 1
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-[#F0F0FA]">
                        Download the Excel template
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#9090A8]">
                        Fill in your leads below row 2 (row 2 is an example — it&apos;s
                        skipped automatically). Columns marked * are required.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateTemplate}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB]"
                    >
                      <Download className="size-3.5" />
                      Download Template
                    </button>
                  </div>
                </section>

                {/* Step 2: Upload */}
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9090A8]">
                    Step 2 — Upload your filled file
                  </p>
                  <label
                    htmlFor="bulk-import-file"
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition ${
                      dragActive
                        ? "border-[#3B82F6] bg-[#1E3A5F]/20"
                        : file
                          ? "border-[#34D399]/40 bg-[#163322]/20"
                          : "border-[#2A2A3C] bg-[#0F0F15] hover:border-[#3B82F6] hover:bg-[#1A1A24]"
                    }`}
                  >
                    <input
                      ref={inputRef}
                      id="bulk-import-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFile(f)
                      }}
                    />
                    {parsing ? (
                      <>
                        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
                        <p className="text-xs text-[#9090A8]">Parsing…</p>
                      </>
                    ) : file ? (
                      <>
                        <FileSpreadsheet className="size-6 text-[#34D399]" />
                        <p className="text-sm font-medium text-[#F0F0FA]">{file.name}</p>
                        <p className="text-[11px] text-[#9090A8]">
                          Click or drop another file to replace
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="size-6 text-[#9090A8]" />
                        <p className="text-sm font-medium text-[#F0F0FA]">
                          Click to upload, or drag & drop
                        </p>
                        <p className="text-[11px] text-[#9090A8]">
                          Accepts .xlsx, .xls and .csv
                        </p>
                      </>
                    )}
                  </label>
                </section>

                {/* Step 3: Preview & validate */}
                {rows.length > 0 && !importResult && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9090A8]">
                        Step 3 — Preview & validate
                      </p>
                      <p className="text-xs">
                        <span className="text-[#34D399]">{validCount} valid</span>
                        <span className="mx-1.5 text-[#9090A8]">·</span>
                        <span className="text-[#F87171]">{errorCount} errors</span>
                        <span className="mx-1.5 text-[#9090A8]">·</span>
                        <span className="text-[#F59E0B]">{dupCount} duplicates</span>
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[#2A2A3C]">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0F0F15] text-[10px] uppercase tracking-wider text-[#9090A8]">
                          <tr>
                            <th className="px-3 py-2 text-left">Row</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Phone</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Service</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A2A3C]/60">
                          {rows.map((r) => (
                            <tr
                              key={r.row}
                              className={
                                r.status === "error"
                                  ? "bg-[#3F161A]/30"
                                  : r.status === "duplicate"
                                    ? "bg-[#3F2A12]/25"
                                    : ""
                              }
                            >
                              <td className="px-3 py-2 font-mono text-[#9090A8]">
                                {r.row}
                              </td>
                              <td className="px-3 py-2 text-[#F0F0FA]">
                                {r.full_name || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#F0F0FA]">
                                {r.phone || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9090A8]">
                                {r.company_name || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9090A8]">
                                {r.service_line || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {r.status === "valid" ? (
                                  <span className="inline-flex items-center gap-1 text-[#34D399]">
                                    <CheckCircle2 className="size-3" />
                                    Valid
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      r.status === "error"
                                        ? "text-[#F87171]"
                                        : "text-[#F59E0B]"
                                    }`}
                                    title={r.error}
                                  >
                                    <AlertCircle className="size-3" />
                                    {r.error ?? r.status}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Step 4: Result */}
                {importResult && (
                  <section className="rounded-xl border border-[#34D399]/40 bg-[#163322]/30 p-5 text-center">
                    <CheckCircle2 className="mx-auto size-8 text-[#34D399]" />
                    <p className="mt-2 text-sm font-semibold text-[#F0F0FA]">
                      Successfully imported {importResult.imported} lead
                      {importResult.imported === 1 ? "" : "s"}
                    </p>
                    {(importResult.skipped > 0 || importResult.errors > 0) && (
                      <p className="mt-1 text-xs text-[#9090A8]">
                        Skipped {importResult.skipped} · Errors {importResult.errors}
                      </p>
                    )}
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2A2A3C] bg-[#0F0F15] px-6 py-4">
                <button
                  type="button"
                  onClick={closeBulkImportModal}
                  disabled={importing}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA] disabled:opacity-50"
                >
                  {importResult ? "Close" : "Cancel"}
                </button>
                {!importResult && rows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={validCount === 0 || importing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="size-3" />
                        Import {validCount} Valid Lead
                        {validCount === 1 ? "" : "s"}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
