"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Archive, Download, FileImage, FileSpreadsheet, FileText, FileVideo,
  FolderArchive, Loader2, Plus, Presentation, Search, Share2,
} from "lucide-react"

import { ShareDocumentModal } from "@/components/documents/ShareDocumentModal"
import { UploadDocumentModal } from "@/components/documents/UploadDocumentModal"
import {
  CATEGORY_LABELS, CATEGORY_ORDER, DELETE_ROLES, SERVICE_LINE_LABELS, UPLOAD_ROLES,
  downloadUrl, formatBytes,
} from "@/components/documents/document-meta"
import { useUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument, DocumentCategory } from "@/lib/types"
import { cn } from "@/lib/utils"

function iconFor(doc: CompanyDocument) {
  const t = `${doc.mime_type ?? ""} ${doc.file_name}`.toLowerCase()
  if (/presentation|\.pptx?/.test(t)) return Presentation
  if (/image|\.(png|jpe?g|webp)/.test(t)) return FileImage
  if (/sheet|excel|\.xlsx?/.test(t)) return FileSpreadsheet
  if (/video|\.mp4/.test(t)) return FileVideo
  if (/zip/.test(t)) return FolderArchive
  return FileText
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const { profile } = useUser()
  const role = (profile?.role as string | undefined) ?? "sales_rep"
  const canUpload = UPLOAD_ROLES.includes(role)
  const canArchive = DELETE_ROLES.includes(role)

  const [category, setCategory] = useState<DocumentCategory | "all">("all")
  const [serviceLine, setServiceLine] = useState("all")
  const [search, setSearch] = useState("")
  const [showSuperseded, setShowSuperseded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [sharing, setSharing] = useState<CompanyDocument | null>(null)

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<CompanyDocument[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("documents")
        .select("*, uploader:uploaded_by(full_name)")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as CompanyDocument[]
    },
  })

  const all = useMemo(() => documents ?? [], [documents])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of all) if (d.is_current) c[d.category] = (c[d.category] ?? 0) + 1
    return c
  }, [all])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => {
      if (!showSuperseded && !d.is_current) return false
      if (category !== "all" && d.category !== category) return false
      // A document for "all services" is relevant whatever line is picked.
      if (serviceLine !== "all" && d.service_line !== serviceLine && d.service_line !== "all") return false
      if (!q) return true
      return [d.title, d.description, d.file_name, ...(d.tags ?? [])]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    })
  }, [all, category, serviceLine, search, showSuperseded])

  const onDownload = (doc: CompanyDocument) => {
    window.open(downloadUrl(doc.file_url, doc.file_name), "_blank", "noopener")
    createClient().rpc("bump_document_downloads", { doc_id: doc.id }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    })
  }

  const onArchive = async (doc: CompanyDocument) => {
    if (!window.confirm(`Remove "${doc.title}" from the library? The file is kept for records.`)) return
    const { error } = await createClient().from("documents").update({ is_active: false }).eq("id", doc.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Removed from library")
    queryClient.invalidateQueries({ queryKey: ["documents"] })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
            Profiles & Pitches
          </h1>
          <p className="mt-1 text-sm text-[#9090A8]">
            The current company profile, pitch decks and collateral — download or share straight to a lead.
          </p>
        </div>
        {canUpload ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white transition hover:bg-[#2563EB] md:px-4"
          >
            <Plus className="size-4" />
            Upload
          </button>
        ) : null}
      </div>

      {/* Category tabs — scroll sideways on phones */}
      <div className="thin-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(["all", ...CATEGORY_ORDER] as const)
          .filter((c) => c === "all" || counts[c])
          .map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                category === c
                  ? "border-[#3B82F6] bg-[#3B82F6]/15 text-[#F0F0FA]"
                  : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c]}
              <span className="text-xs text-[#5A5A72]">
                {c === "all" ? all.filter((d) => d.is_current).length : counts[c]}
              </span>
            </button>
          ))}
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents"
            className="h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] sm:h-10 sm:text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={serviceLine}
            onChange={(e) => setServiceLine(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none sm:h-10 sm:flex-none"
          >
            {Object.entries(SERVICE_LINE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-xs text-[#9090A8] sm:h-10">
            <input
              type="checkbox"
              checked={showSuperseded}
              onChange={(e) => setShowSuperseded(e.target.checked)}
              className="size-4 accent-[#3B82F6]"
            />
            Old versions
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading library…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load the library. If this is a fresh setup, the document library migration may not be applied yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-16 text-center">
          <FileText className="mx-auto size-8 text-[#3A3A52]" />
          <p className="mt-3 text-sm font-medium text-[#F0F0FA]">
            {all.length === 0 ? "The library is empty" : "Nothing matches"}
          </p>
          <p className="mt-1 text-xs text-[#9090A8]">
            {all.length === 0
              ? canUpload
                ? "Upload the company profile first — it is what the field team shares most."
                : "Ask an admin or marketing to upload the company profile."
              : "Try another category or search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const Icon = iconFor(doc)
            return (
              <div
                key={doc.id}
                className={cn(
                  "flex flex-col rounded-xl border border-[#2A2A3C] bg-[#111118] p-4",
                  !doc.is_current && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#1F1F2E]">
                    <Icon className="size-5 text-[#60A5FA]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-[#F0F0FA]">{doc.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#9090A8]">
                      <span className="rounded-full bg-[#1F1F2E] px-2 py-0.5">{CATEGORY_LABELS[doc.category]}</span>
                      <span className={cn("rounded-full px-2 py-0.5", doc.is_current ? "bg-[#163322] text-[#34D399]" : "bg-[#1F1F2E]")}>
                        {doc.version}{doc.is_current ? " · current" : " · superseded"}
                      </span>
                      {doc.service_line !== "all" ? <span>{SERVICE_LINE_LABELS[doc.service_line]}</span> : null}
                    </div>
                  </div>
                </div>

                {doc.description ? (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#9090A8]">{doc.description}</p>
                ) : null}

                <p className="mt-3 text-[11px] text-[#5A5A72]">
                  {formatBytes(doc.file_size)} · {format(new Date(doc.created_at), "d MMM yyyy")}
                  {doc.uploader?.full_name ? ` · ${doc.uploader.full_name}` : ""}
                  {" · "}{doc.download_count} downloads · {doc.share_count} shares
                </p>

                <div className="mt-auto flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => onDownload(doc)}
                    className="inline-flex h-10 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] text-sm text-[#F0F0FA] transition hover:border-[#3A3A52]"
                  >
                    <Download className="size-4" /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharing(doc)}
                    className="inline-flex h-10 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-[#3B82F6] text-sm font-medium text-white transition hover:bg-[#2563EB]"
                  >
                    <Share2 className="size-4" /> Share
                  </button>
                  {canArchive ? (
                    <button
                      type="button"
                      onClick={() => onArchive(doc)}
                      aria-label="Remove from library"
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#5A5A72] transition hover:text-[#F87171]"
                    >
                      <Archive className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => queryClient.invalidateQueries({ queryKey: ["documents"] })}
        existing={all}
      />
      <ShareDocumentModal document={sharing} onClose={() => setSharing(null)} />
    </div>
  )
}
