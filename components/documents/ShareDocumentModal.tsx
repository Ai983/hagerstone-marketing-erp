"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Copy, Mail, MessageCircle, Share2, UserRound, X } from "lucide-react"

import { LeadPickerModal, type PickedLead } from "@/components/leads/LeadPickerModal"
import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument } from "@/lib/types"

import { documentUrl } from "./document-meta"

type Channel = "whatsapp" | "email" | "link"

/**
 * Nothing is sent automatically (the founder's hard rule): this opens
 * WhatsApp or the mail app pre-filled, the person taps send, and the
 * share is recorded against the lead so the next caller knows the
 * client already has this version.
 */
export function ShareDocumentModal({
  document,
  onClose,
}: {
  document: CompanyDocument | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [lead, setLead] = useState<PickedLead | null>(null)
  const [picking, setPicking] = useState(false)

  const close = () => {
    setLead(null)
    onClose()
  }

  if (!document) return null

  const isPitch = document.kind === "pitch"
  const url = documentUrl(document) ?? ""
  const firstName = lead?.full_name.split(" ")[0] ?? ""
  // A pitch is sent as its own text; files and Drive links as a short note + link.
  const message = isPitch
    ? (document.body ?? "").replace(/\[Name\]/g, firstName || "[Name]")
    : [
        lead ? `Hello ${firstName},` : "Hello,",
        "",
        `Please find the Hagerstone ${document.title} here:`,
        url,
        "",
        "Happy to walk you through it at your convenience.",
      ].join("\n")

  const record = async (channel: Channel) => {
    const supabase = createClient()
    const user = await getCachedUser()
    let interactionId: string | null = null

    if (lead) {
      const { data } = await supabase
        .from("interactions")
        .insert({
          lead_id: lead.id,
          user_id: user?.id ?? null,
          type: channel === "whatsapp" ? "whatsapp_sent" : channel === "email" ? "email_sent" : "note",
          title: `Shared: ${document.title} (${document.version})`,
          notes: isPitch
            ? `${document.title} sent via ${channel}.\n\n${message}`
            : `${document.title} ${document.version} shared via ${channel}.\n${url}`,
        })
        .select("id")
        .maybeSingle()
      interactionId = data?.id ?? null
    }

    await supabase.from("document_shares").insert({
      document_id: document.id,
      lead_id: lead?.id ?? null,
      channel,
      interaction_id: interactionId,
      recipient: channel === "whatsapp" ? lead?.phone ?? null : channel === "email" ? lead?.email ?? null : null,
      shared_by: user?.id ?? null,
    })
    await supabase.rpc("bump_document_shares", { doc_id: document.id })

    queryClient.invalidateQueries({ queryKey: ["documents"] })
    queryClient.invalidateQueries({ queryKey: ["document-performance"] })
    if (lead) {
      queryClient.invalidateQueries({ queryKey: ["document-shares", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", lead.id] })
    }
  }

  const shareWhatsApp = async () => {
    const digits = (lead?.phone ?? "").replace(/\D/g, "")
    const to = digits.length === 10 ? `91${digits}` : digits
    const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank", "noopener")
    await record("whatsapp")
    toast.success(lead ? `Logged on ${lead.full_name}` : "WhatsApp opened")
    close()
  }

  const shareEmail = async () => {
    const subject = `Hagerstone — ${document.title}`
    window.location.href = `mailto:${lead?.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    await record("email")
    toast.success(lead ? `Logged on ${lead.full_name}` : "Mail app opened")
    close()
  }

  const shareNative = async () => {
    // Phones: the OS share sheet — WhatsApp groups, Telegram, anything.
    try {
      await navigator.share({ title: document.title, text: message })
      await record("link")
      toast.success(lead ? `Logged on ${lead.full_name}` : "Shared")
      close()
    } catch {
      // user dismissed the sheet — nothing to record
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(isPitch ? message : url)
    await record("link")
    toast.success(isPitch ? "Pitch copied" : "Link copied")
    close()
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"
  const btn = "flex h-12 w-full touch-manipulation items-center gap-3 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-4 text-sm text-[#F0F0FA] transition hover:border-[#3A3A52] disabled:opacity-40"

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative w-full rounded-t-2xl border border-[#2A2A3C] bg-[#111118] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#F0F0FA]">{isPitch ? "Send pitch" : "Share"}</h2>
                <p className="truncate text-xs text-[#9090A8]">{document.title} · {document.version}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                <X className="size-5" />
              </button>
            </div>

            <button type="button" onClick={() => setPicking(true)} className={`${btn} mb-3 border-dashed`}>
              <UserRound className="size-4 text-[#9090A8]" />
              {lead ? (
                <span className="min-w-0 flex-1 truncate text-left">
                  {lead.full_name}
                  <span className="text-[#9090A8]"> · {lead.company_name ?? lead.phone ?? ""}</span>
                </span>
              ) : (
                <span className="flex-1 text-left text-[#9090A8]">Choose a lead (recommended — logs the share)</span>
              )}
            </button>

            <div className="space-y-2">
              <button type="button" onClick={shareWhatsApp} className={btn}>
                <MessageCircle className="size-4 text-[#25D366]" />
                WhatsApp{lead?.phone ? ` to ${lead.phone}` : ""}
              </button>
              <button type="button" onClick={shareEmail} className={btn}>
                <Mail className="size-4 text-[#60A5FA]" />
                Email{lead?.email ? ` to ${lead.email}` : ""}
              </button>
              {canNativeShare ? (
                <button type="button" onClick={shareNative} className={btn}>
                  <Share2 className="size-4 text-[#A78BFA]" />
                  More apps…
                </button>
              ) : null}
              <button type="button" onClick={copyLink} className={btn}>
                <Copy className="size-4 text-[#9090A8]" />
                {isPitch ? "Copy text" : "Copy link"}
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <LeadPickerModal
        open={picking}
        title="Share with which lead?"
        subtitle={document.title}
        onClose={() => setPicking(false)}
        onPick={(l) => {
          setLead(l)
          setPicking(false)
        }}
      />
    </>
  )
}
