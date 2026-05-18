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
  Camera,
  CaseSensitive,
  Code2,
  Eye,
  Film,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Music,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react"
import { RichTextEditor } from "@/components/email/RichTextEditor"
import { VideoInsertPanel } from "@/components/email/VideoInsertPanel"
import { createClient } from "@/lib/supabase/client"
import { getCachedUser } from "@/lib/hooks/useUser"
import { plainTextToEmailHtml } from "@/lib/utils/email-content"
import { cn } from "@/lib/utils"

const BUCKET_NAME = "campaign-media"
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB
const MAX_MESSAGE_CHARACTERS = 5000
const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,video/*,audio/*,.mp3,.m4a,.aac,.ogg,.wav"

// ── Types ───────────────────────────────────────────────────────────

export type MediaType = "image" | "document" | "video" | "audio"

export interface MessageButtonDraft {
  id: string
  title: string
}

export interface MessageDraft {
  id: string // local-only — for stable React keys + dnd
  position: number
  delay_days: number
  channel: "whatsapp" | "email"
  message_template: string
  email_subject: string
  email_template_id: string | null
  media_url: string | null
  media_type: MediaType | null
  media_filename: string | null
  buttons: MessageButtonDraft[]
}

// ── Helpers ─────────────────────────────────────────────────────────

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  // Some browsers don't set MIME for Office documents — fall back to extension
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image"
  if (["mp4", "mov", "webm", "mkv"].includes(ext)) return "video"
  if (["mp3", "m4a", "aac", "ogg", "wav"].includes(ext)) return "audio"
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
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    wav: "audio/wav",
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
  if (media_type === "audio") return "AUDIO"
  if (media_type === "document") return "DOC"
  return "TEXT"
}

function typeBadgeColor(media_type: MediaType | null): string {
  if (media_type === "image") return "bg-[#2E1A47] text-[#C084FC]"
  if (media_type === "video") return "bg-[#1E3A5F] text-[#60A5FA]"
  if (media_type === "audio") return "bg-[#123A34] text-[#2DD4BF]"
  if (media_type === "document") return "bg-[#3A2413] text-[#FB923C]"
  return "bg-[#1A1A24] text-[#9090A8]"
}

function createButtonId(): string {
  return `btn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
  const [editorMode, setEditorMode] = useState<"rich" | "html" | "plain">("rich")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false)

  const charCount = message.message_template.length
  const overLimit = charCount > MAX_MESSAGE_CHARACTERS
  const hasMedia = Boolean(message.media_url)
  const isEmail = message.channel === "email"
  const emailPreviewHtml =
    editorMode === "plain"
      ? plainTextToEmailHtml(message.message_template)
      : message.message_template

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

  const addButton = () => {
    const buttons = message.buttons ?? []
    if (buttons.length >= 3) return
    onChange(message.id, {
      buttons: [...buttons, { id: createButtonId(), title: "" }],
    })
  }

  const updateButton = (buttonIndex: number, title: string) => {
    const buttons = message.buttons ?? []
    onChange(message.id, {
      buttons: buttons.map((button, idx) =>
        idx === buttonIndex ? { ...button, title } : button
      ),
    })
  }

  const removeButton = (buttonIndex: number) => {
    const buttons = message.buttons ?? []
    onChange(message.id, {
      buttons: buttons.filter((_button, idx) => idx !== buttonIndex),
    })
  }

  const handleInsertImage = () => {
    const imageUrl = window.prompt("Paste image URL")
    if (!imageUrl?.trim()) return
    const alt =
      window.prompt("Image alt text", "Hagerstone image") ?? "Hagerstone image"
    const imageHtml = `<p style="text-align:center;"><img src="${imageUrl.trim()}" alt="${alt}" style="max-width:100%; height:auto; border-radius:8px;" /></p>`
    onChange(message.id, {
      message_template: `${message.message_template}${
        message.message_template.trim() ? "\n\n" : ""
      }${imageHtml}`,
    })
  }

  const modeOptions: {
    value: "rich" | "html" | "plain"
    label: string
    icon: typeof Pencil
  }[] = [
    { value: "rich", label: "Rich", icon: Pencil },
    { value: "html", label: "HTML", icon: Code2 },
    { value: "plain", label: "Plain", icon: CaseSensitive },
  ]

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
            <div className="mr-2 grid grid-cols-2 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] p-1">
              {(["whatsapp", "email"] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onChange(message.id, { channel })}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-medium transition",
                    message.channel === channel
                      ? "bg-[#1E3A5F] text-[#60A5FA]"
                      : "text-[#9090A8] hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                  )}
                >
                  {channel === "email" ? (
                    <Mail className="size-3" />
                  ) : (
                    <MessageCircle className="size-3" />
                  )}
                  {channel === "email" ? "Email" : "WhatsApp"}
                </button>
              ))}
            </div>
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

          {isEmail && (
            <div className="space-y-3">
              <input
                type="text"
                value={message.email_subject}
                onChange={(e) =>
                  onChange(message.id, { email_subject: e.target.value })
                }
                disabled={!canEdit}
                placeholder="Email subject"
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6] disabled:opacity-50"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-1">
                  {modeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setEditorMode(value)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA] disabled:opacity-50",
                        editorMode === value &&
                          "bg-[#3B82F6] text-white hover:text-white"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleInsertImage}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E] disabled:opacity-50"
                  >
                    <Camera className="size-3.5" />
                    Insert Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVideoPanelOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                  >
                    <Film className="size-3.5" />
                    Insert Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </button>
                </div>
              </div>

              {isVideoPanelOpen && (
                <div className="mb-3">
                  <VideoInsertPanel
                    onCancel={() => setIsVideoPanelOpen(false)}
                    onInsert={(html) => {
                      onChange(message.id, {
                        message_template:
                          message.message_template +
                          (message.message_template.trim() ? "\n\n" : "") +
                          html,
                      })
                      setIsVideoPanelOpen(false)
                    }}
                  />
                </div>
              )}

              {editorMode === "rich" ? (
                <RichTextEditor
                  content={message.message_template}
                  onChange={(newValue) =>
                    onChange(message.id, { message_template: newValue })
                  }
                  placeholder="Hi {{lead_name}},"
                />
              ) : (
                <textarea
                  value={message.message_template}
                  onChange={(e) =>
                    onChange(message.id, { message_template: e.target.value })
                  }
                  disabled={!canEdit}
                  rows={editorMode === "plain" ? 8 : 10}
                  placeholder={
                    editorMode === "plain"
                      ? "Hi {{lead_name}},"
                      : "<p>Hi {{lead_name}},</p>"
                  }
                  className="w-full resize-y rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6] disabled:opacity-50"
                />
              )}

              <span className="block text-[11px] text-[#9090A8]">
                Available: {"{{lead_name}}"}, {"{{rep_name}}"},{" "}
                {"{{company_name}}"}, {"{{service_line}}"}, {"{{city}}"}
              </span>
            </div>
          )}

          {!isEmail && (
            <>
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
                  {charCount} / {MAX_MESSAGE_CHARACTERS} characters
                </span>
              </div>
            </>
          )}

          {/* Attachment block */}
          {canEdit && !isEmail && (
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
                Images, documents (.pdf, .doc, .docx), video or audio (.mp3). Max 100 MB.
              </p>
            </div>
          )}

          {canEdit && !isEmail && (
            <div className="mt-2">
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.05em] text-[#9090A8]">
                Quick Reply Buttons (optional)
              </p>

              {message.buttons?.map((button, buttonIndex) => (
                <div key={button.id} className="mb-1.5 flex gap-1.5">
                  <input
                    type="text"
                    value={button.title}
                    onChange={(e) => updateButton(buttonIndex, e.target.value)}
                    placeholder="Button text (max 20 chars)"
                    maxLength={20}
                    className="flex-1 rounded-md border border-[#2A2A3C] bg-[#1F1F2E] px-2.5 py-1.5 text-xs text-[#F0F0FA] outline-none placeholder-[#9090A8] focus:border-[#3B82F6]"
                  />
                  <button
                    type="button"
                    onClick={() => removeButton(buttonIndex)}
                    className="rounded-md p-1 text-[#EF4444] transition hover:bg-[#2A1215]"
                    aria-label="Remove button"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {(message.buttons?.length ?? 0) < 3 && (
                <button
                  type="button"
                  onClick={addButton}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#3B82F6] bg-transparent px-2.5 py-1.5 text-[11px] text-[#3B82F6] transition hover:bg-[#3B82F6]/10"
                >
                  <Plus className="size-3" />
                  Add Button
                </button>
              )}

              <p className="mt-1 text-[10px] text-[#3A3A52]">
                Max 3 buttons. Button text max 20 characters.
              </p>
            </div>
          )}

          {/* WhatsApp preview */}
          {!isEmail && (message.message_template.trim() || hasMedia) && (
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
                {hasMedia && message.media_type === "audio" && message.media_url && (
                  <div className="border-b border-black/10 bg-black/5 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-gray-700">
                      <Music className="size-4" />
                      <span className="truncate text-xs">
                        {message.media_filename ?? "audio"}
                      </span>
                    </div>
                    <audio src={message.media_url} controls className="w-full" />
                  </div>
                )}

                {/* Caption / message body */}
                {message.message_template.trim() && (
                  <pre className="whitespace-pre-wrap px-3 py-2 font-sans">
                    {message.message_template}
                  </pre>
                )}
                {message.buttons?.some((button) => button.title.trim()) && (
                  <div className="border-t border-black/10 px-2 py-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {message.buttons
                        .filter((button) => button.title.trim())
                        .slice(0, 3)
                        .map((button) => (
                          <span
                            key={button.id}
                            className="rounded border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-2 py-1 text-[11px] font-medium text-[#1D4ED8]"
                          >
                            {button.title}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {isEmail && isPreviewOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
              <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
                <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F0F0FA]">
                      {message.email_subject || "Preview"}
                    </p>
                    <p className="text-xs text-[#9090A8]">
                      Campaign email message
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-lg p-2 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="thin-scrollbar max-h-[70vh] overflow-y-auto p-5">
                  <div
                    className="email-preview prose max-w-none rounded-lg bg-white p-5 text-sm leading-relaxed text-gray-900"
                    dangerouslySetInnerHTML={{
                      __html: emailPreviewHtml || "<p>No body yet.</p>",
                    }}
                  />
                </div>
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
  const Icon =
    mediaType === "image"
      ? ImageIcon
      : mediaType === "video"
        ? Video
        : mediaType === "audio"
          ? Music
          : FileText
  const label =
    mediaType === "image"
      ? "Image"
      : mediaType === "video"
        ? "Video"
        : mediaType === "audio"
          ? "Audio"
          : "Document"
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
        channel: "whatsapp",
        message_template: "",
        email_subject: "",
        email_template_id: null,
        media_url: null,
        media_type: null,
        media_filename: null,
        buttons: [],
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
    if (messages.some((m) => m.message_template.length > MAX_MESSAGE_CHARACTERS)) {
      toast.error(`One or more messages exceed ${MAX_MESSAGE_CHARACTERS} characters`)
      return
    }
    if (messages.some((m) => m.channel === "email" && !m.email_subject.trim())) {
      toast.error("Every email step needs a subject")
      return
    }
    if (messages.some((m) => (m.buttons ?? []).length > 3)) {
      toast.error("Each message can have at most 3 quick reply buttons")
      return
    }
    if (
      messages.some((m) =>
        (m.buttons ?? []).some((button) => button.title.trim().length > 20)
      )
    ) {
      toast.error("Button text cannot exceed 20 characters")
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
            channel: m.channel,
            message_template: m.message_template,
            email_subject: m.email_subject,
            email_template_id: m.email_template_id,
            media_url: m.media_url,
            media_type: m.media_type,
            media_filename: m.media_filename,
            buttons: (m.buttons ?? [])
              .filter((button) => button.title.trim())
              .slice(0, 3)
              .map((button) => ({
                id: button.id,
                title: button.title.trim(),
              })),
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
