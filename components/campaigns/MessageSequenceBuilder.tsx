"use client"

// MANUAL STEP (one-time):
// Create a Supabase Storage bucket named `campaign-media` with public
// read access and a 100 MB file size limit. See
// supabase/campaign_messages_media.sql for the full instructions.

import { useEffect, useRef, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  FileText,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCachedUser } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"

const BUCKET_NAME = "campaign-media"
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB
const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,video/*"

// ── Types ───────────────────────────────────────────────────────────

export type MediaType = "image" | "document" | "video"

export interface MessageDraft {
  id: string // local-only — for stable React keys + dnd
  position: number
  delay_days: number
  message_template: string
  media_url: string | null
  media_type: MediaType | null
  media_filename: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  // Some browsers don't set MIME for Office documents — fall back to extension
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image"
  if (["mp4", "mov", "webm", "mkv"].includes(ext)) return "video"
  return "document"
}

/**
 * Supabase's `contentType` sometimes comes through empty for Office files
 * and certain PDFs. Guess from the extension when that happens so downloads
 * open inline rather than prompting for download with octet-stream.
 */
function contentTypeFallback(file: File): string | undefined {
  if (file.type) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  }
  return map[ext]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function typeBadge(media_type: MediaType | null): string {
  if (media_type === "image") return "IMAGE"
  if (media_type === "video") return "VIDEO"
  if (media_type === "document") return "DOC"
  return "TEXT"
}

function typeBadgeColor(media_type: MediaType | null): string {
  if (media_type === "image") return "bg-[#2E1A47] text-[#C084FC]"
  if (media_type === "video") return "bg-[#1E3A5F] text-[#60A5FA]"
  if (media_type === "document") return "bg-[#3A2413] text-[#FB923C]"
  return "bg-[#1A1A24] text-[#9090A8]"
}

// ── Sortable row ────────────────────────────────────────────────────

interface MessageRowProps {
  campaignId: string
  message: MessageDraft
  index: number
  canEdit: boolean
  onChange: (id: string, patch: Partial<MessageDraft>) => void
  onDelete: (id: string) => void
}

function SortableMessageRow({
  campaignId,
  message,
  index,
  canEdit,
  onChange,
  onDelete,
}: MessageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: message.id })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const charCount = message.message_template.length
  const overLimit = charCount > 1000
  const hasMedia = Boolean(message.media_url)

  const handleFileSelect = async (file: File) => {
    if (uploading) return // guard against double-clicks

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File exceeds 100 MB (${formatFileSize(file.size)})`)
      return
    }
    if (file.size === 0) {
      toast.error("File is empty")
      return
    }

    setUploading(true)
    try {
      // Sanity check: make sure we still have a session. An expired JWT
      // produces cryptic storage RLS errors — catch that up-front.
      // Uses the shared cache so we don't race the auth-token lock.
      const user = await getCachedUser()
      if (!user) {
        toast.error("Session expired — please refresh and sign in again")
        return
      }

      const supabase = createClient()
      const mediaType = detectMediaType(file)
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")

      // Path avoids the temp client-id so unsaved-then-saved messages
      // don't leave `tmp-…/` folders lying around. Time + random suffix
      // guarantees uniqueness so upsert isn't strictly needed, but we
      // flip upsert on anyway to make "pick the same file again" fine.
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const path = `campaigns/${campaignId}/${suffix}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: contentTypeFallback(file),
        })

      if (uploadError) {
        // Log everything — Supabase storage errors carry useful fields
        // (statusCode, error, message) that get stripped when we stringify.
        console.error("Storage upload failed:", uploadError, {
          path,
          bucket: BUCKET_NAME,
          fileSize: file.size,
          fileType: file.type,
        })

        const e = uploadError as { message?: string; statusCode?: string; error?: string }
        const raw = `${e.message ?? ""} ${e.error ?? ""}`.toLowerCase()

        if (raw.includes("bucket") && raw.includes("not found")) {
          toast.error(
            `Bucket "${BUCKET_NAME}" doesn't exist. Create it in Supabase Storage (Public, 100 MB limit).`
          )
        } else if (raw.includes("row-level security") || raw.includes("rls") || e.statusCode === "403") {
          toast.error(
            "Upload blocked by Storage RLS. Check the campaign-media bucket policies — authenticated users need INSERT."
          )
        } else if (raw.includes("jwt") || raw.includes("unauthoriz") || e.statusCode === "401") {
          toast.error("Session expired — please refresh and sign in again")
        } else if (raw.includes("payload too large") || e.statusCode === "413") {
          toast.error(
            "File too large for the bucket. Increase the bucket's file-size limit in Supabase Storage."
          )
        } else {
          toast.error(`Upload failed: ${e.message ?? e.error ?? "Unknown error"}`)
        }
        return
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path)

      if (!urlData?.publicUrl) {
        toast.error(
          "Uploaded, but couldn't get a public URL. Make sure the bucket is marked Public."
        )
        console.error("getPublicUrl returned empty:", urlData)
        return
      }

      onChange(message.id, {
        media_url: urlData.publicUrl,
        media_type: mediaType,
        media_filename: file.name,
      })
      toast.success("Attachment uploaded")
    } catch (err) {
      console.error("Upload threw:", err)
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveAttachment = () => {
    // Note: not deleting from storage to keep undo/history simple.
    // The orphaned file can be cleaned up by a periodic job later.
    onChange(message.id, {
      media_url: null,
      media_type: null,
      media_filename: null,
    })
    toast("Attachment removed")
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-[#2A2A3C] bg-[#111118] p-4",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab pt-1 text-[#9090A8] transition hover:text-[#F0F0FA] active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Position badge + paperclip indicator */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex size-7 items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-semibold text-[#3B82F6]">
            {index + 1}
          </div>
          {hasMedia && (
            <Paperclip
              className="size-3 text-[#C084FC]"
              aria-label="Has attachment"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {/* Delay + type badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Send after
            </label>
            <input
              type="number"
              min={0}
              value={message.delay_days}
              onChange={(e) =>
                onChange(message.id, {
                  delay_days: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              disabled={!canEdit}
              className="w-16 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-50"
            />
            <span className="text-xs text-[#9090A8]">days</span>

            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider",
                typeBadgeColor(message.media_type)
              )}
            >
              {typeBadge(message.media_type)}
            </span>
          </div>

          {/* Message body */}
          <textarea
            value={message.message_template}
            onChange={(e) =>
              onChange(message.id, { message_template: e.target.value })
            }
            disabled={!canEdit}
            placeholder={
              hasMedia
                ? "Caption (shown below the attachment)…"
                : "Hi {{name}}, just following up on your enquiry…"
            }
            rows={4}
            className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6] disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px]",
                overLimit ? "text-[#F87171]" : "text-[#9090A8]"
              )}
            >
              {charCount} / 1000 characters
            </span>
          </div>

          {/* Attachment block */}
          {canEdit && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelect(f)
                }}
              />
              {hasMedia ? (
                <AttachmentPreview
                  mediaType={message.media_type!}
                  mediaUrl={message.media_url!}
                  filename={message.media_filename ?? "attachment"}
                  onRemove={handleRemoveAttachment}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#2A2A3C] bg-[#0F0F15] px-3 py-2 text-xs font-medium text-[#9090A8] transition hover:border-[#3B82F6] hover:bg-[#1A1A24] hover:text-[#F0F0FA] disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Paperclip className="size-3" />
                      Add Attachment
                    </>
                  )}
                </button>
              )}
              <p className="mt-1 text-[10px] text-[#5A5A72]">
                Images, documents (.pdf, .doc, .docx) or video. Max 100 MB.
              </p>
            </div>
          )}

          {/* WhatsApp preview */}
          {(message.message_template.trim() || hasMedia) && (
            <div className="rounded-lg bg-[#1F2937] p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-[#9090A8]">
                WhatsApp Preview
              </p>
              <div className="max-w-[80%] overflow-hidden rounded-lg rounded-tl-sm bg-[#F0F0FA] text-xs leading-relaxed text-gray-900">
                {/* Media preview in bubble */}
                {hasMedia && message.media_type === "image" && message.media_url && (
                  <div className="bg-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.media_url}
                      alt={message.media_filename ?? "attachment"}
                      className="max-h-40 w-full object-cover"
                    />
                  </div>
                )}
                {hasMedia && message.media_type === "document" && (
                  <div className="flex items-center gap-2 border-b border-black/10 bg-black/5 px-3 py-2">
                    <FileText className="size-5 text-gray-600" />
                    <span className="truncate text-xs text-gray-700">
                      {message.media_filename ?? "document"}
                    </span>
                  </div>
                )}
                {hasMedia && message.media_type === "video" && message.media_url && (
                  <div className="bg-black/10">
                    <video
                      src={message.media_url}
                      className="max-h-40 w-full object-cover"
                      controls
                      muted
                    />
                  </div>
                )}

                {/* Caption / message body */}
                {message.message_template.trim() && (
                  <pre className="whitespace-pre-wrap px-3 py-2 font-sans">
                    {message.message_template}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(message.id)}
          disabled={!canEdit}
          className="shrink-0 rounded-md border border-[#2A2A3C] p-1.5 text-[#F87171] transition hover:bg-[#2A1215] disabled:opacity-50"
          aria-label="Delete message"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Attachment preview ──────────────────────────────────────────────

function AttachmentPreview({
  mediaType,
  mediaUrl,
  filename,
  onRemove,
}: {
  mediaType: MediaType
  mediaUrl: string
  filename: string
  onRemove: () => void
}) {
  const Icon = mediaType === "image" ? ImageIcon : mediaType === "video" ? Video : FileText
  const label = mediaType === "image" ? "Image" : mediaType === "video" ? "Video" : "Document"
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] p-2">
      {mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt={filename}
          className="size-12 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded bg-[#1A1A24] text-[#C084FC]">
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#F0F0FA]">{filename}</p>
        <p className="text-[11px] text-[#9090A8]">{label} attachment</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1 rounded-md border border-[#2A2A3C] px-2 py-1 text-[11px] text-[#F87171] transition hover:bg-[#2A1215]"
      >
        <X className="size-3" />
        Remove
      </button>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

interface MessageSequenceBuilderProps {
  campaignId: string
  initialMessages: MessageDraft[]
  canEdit: boolean
}

export function MessageSequenceBuilder({
  campaignId,
  initialMessages,
  canEdit,
}: MessageSequenceBuilderProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<MessageDraft[]>(initialMessages)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setMessages(initialMessages)
    setDirty(false)
  }, [initialMessages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setMessages((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
    setDirty(true)
  }

  const handleChange = (id: string, patch: Partial<MessageDraft>) => {
    setMessages((items) => items.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    setDirty(true)
  }

  const handleAdd = () => {
    setMessages((items) => [
      ...items,
      {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        position: items.length + 1,
        delay_days: items.length === 0 ? 0 : 2,
        message_template: "",
        media_url: null,
        media_type: null,
        media_filename: null,
      },
    ])
    setDirty(true)
  }

  const handleDelete = (id: string) => {
    setMessages((items) => items.filter((m) => m.id !== id))
    setDirty(true)
  }

  const handleSave = async () => {
    // Allow blank caption if media is attached
    if (
      messages.some(
        (m) => !m.message_template.trim() && !m.media_url
      )
    ) {
      toast.error("Every message needs a body or an attachment")
      return
    }
    if (messages.some((m) => m.message_template.length > 1000)) {
      toast.error("One or more messages exceed 1000 characters")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/messages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            position: m.position,
            delay_days: m.delay_days,
            message_template: m.message_template,
            media_url: m.media_url,
            media_type: m.media_type,
            media_filename: m.media_filename,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      queryClient.invalidateQueries({ queryKey: ["campaign-detail", campaignId] })

      toast.success("Sequence saved successfully")
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#0F0F15] p-10 text-center">
          <p className="text-sm font-medium text-[#F0F0FA]">No messages yet</p>
          <p className="mt-1 text-xs text-[#9090A8]">
            Add the first message in this campaign sequence.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={messages.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {messages.map((m, idx) => (
                <SortableMessageRow
                  key={m.id}
                  campaignId={campaignId}
                  message={m}
                  index={idx}
                  canEdit={canEdit}
                  onChange={handleChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E] disabled:opacity-50"
          >
            <Plus className="size-3" />
            Add Message
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Save Sequence
          </button>
        </div>
      )}
    </div>
  )
}
