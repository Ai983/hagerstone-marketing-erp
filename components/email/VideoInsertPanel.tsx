"use client"

import { useMemo, useState } from "react"
import { Film, X } from "lucide-react"
import { toast } from "sonner"

import { generateVideoHTML, parseVideoUrl } from "@/lib/utils/video-embed"
import { cn } from "@/lib/utils"

interface VideoInsertPanelProps {
  onCancel: () => void
  onInsert: (html: string) => void
}

export function VideoInsertPanel({ onCancel, onInsert }: VideoInsertPanelProps) {
  const [url, setUrl] = useState("")
  const [caption, setCaption] = useState("")

  const meta = useMemo(() => parseVideoUrl(url.trim()), [url])
  const hasUrl = url.trim().length > 0

  const handleInsert = () => {
    if (!meta) {
      toast.error("Invalid URL. Supported: YouTube, Vimeo, Loom, Google Drive")
      return
    }

    onInsert(generateVideoHTML(meta, caption.trim() || undefined))
  }

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#0F0F15] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-[#3B82F6]" />
          <p className="text-sm font-semibold text-[#F0F0FA]">Insert Video</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
          aria-label="Close video panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3">
        <label>
          <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
            Video URL
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube, Vimeo, Loom, or Drive URL"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
          />
          <span className="mt-1 block text-[11px] leading-relaxed text-[#9090A8]">
            ✅ Supported: YouTube — youtube.com/watch?v=... or youtu.be/...;
            Vimeo — vimeo.com/...; Loom — loom.com/share/...; Google Drive —
            drive.google.com/file/d/.../view
          </span>
        </label>

        <label>
          <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
            Caption (optional)
          </span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Watch our portfolio video"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
          />
        </label>

        {hasUrl && (
          <div
            className={cn(
              "rounded-lg border p-3",
              meta
                ? "border-[#10B981]/40 bg-[#123A34]/40"
                : "border-[#7F1D1D]/40 bg-[#2A1215]/40"
            )}
          >
            {meta ? (
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.thumbnailUrl}
                  alt="Video thumbnail preview"
                  className="h-[100px] w-40 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#60A5FA]">
                    {meta.provider}
                  </span>
                  <p className="mt-2 text-sm font-medium text-[#34D399]">
                    Looks good!
                  </p>
                  <p className="mt-1 truncate text-xs text-[#9090A8]">
                    {meta.originalUrl}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#F87171]">
                Invalid URL. Supported: YouTube, Vimeo, Loom, Google Drive
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-[#2A2A3C] px-4 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleInsert}
          className="h-9 rounded-lg bg-[#3B82F6] px-4 text-xs font-medium text-white transition hover:bg-[#2563EB]"
        >
          Insert Video
        </button>
      </div>
    </div>
  )
}
