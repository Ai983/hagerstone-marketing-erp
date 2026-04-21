"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { X, MessageSquare, Loader2, AlertTriangle } from "lucide-react"

interface SendWhatsAppModalProps {
  open: boolean
  leadId: string
  leadName: string
  leadPhone: string
  whatsappOptedIn: boolean
  currentUserId: string | null
  prefillMessage?: string
  onClose: () => void
  onSent: () => void
}

export function SendWhatsAppModal({
  open,
  leadName,
  leadPhone,
  whatsappOptedIn,
  onClose,
  onSent,
  prefillMessage,
}: SendWhatsAppModalProps) {
  const [phone, setPhone] = useState(leadPhone || "")
  const [message, setMessage] = useState(prefillMessage ?? "")
  const [consentOverride, setConsentOverride] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Reset local state when opening with new values
  const handleClose = () => {
    setPhone(leadPhone || "")
    setMessage(prefillMessage ?? "")
    setConsentOverride(false)
    onClose()
  }

  const canSend =
    phone.trim() !== "" &&
    message.trim() !== "" &&
    (whatsappOptedIn || consentOverride)

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_number: phone.trim(),
          message: message.trim(),
          lead_name: leadName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message")
      }

      toast.success("WhatsApp message sent")
      onSent()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="whatsapp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={handleClose}
          />
          <motion.div
            key="whatsapp-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 z-[61] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A3C] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-[#34D399]" />
                <h3 className="text-sm font-semibold text-[#F0F0FA]">
                  Send WhatsApp — {leadName}
                </h3>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1 text-[#9090A8] transition hover:text-[#F0F0FA]">
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <div className="space-y-4">
                {/* Opt-in warning */}
                {!whatsappOptedIn && (
                  <div className="rounded-lg border border-[#F59E0B]/30 bg-[#3F2A12]/40 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#F59E0B]">
                          This lead has not opted in to WhatsApp
                        </p>
                        <label className="mt-2 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={consentOverride}
                            onChange={(e) => setConsentOverride(e.target.checked)}
                            className="size-3.5 rounded border-[#2A2A3C] accent-[#F59E0B]"
                          />
                          <span className="text-[11px] text-[#F0F0FA]">
                            Send anyway (rep confirms verbal consent)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Phone number */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={5}
                    className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
                  />
                  <p className="mt-1 text-right text-[11px] text-[#9090A8]">
                    {message.length} characters
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[#2A2A3C] px-5 py-3.5">
              <button
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !canSend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#1da851] disabled:opacity-50"
              >
                {isSending && <Loader2 className="size-3 animate-spin" />}
                <MessageSquare className="size-3" />
                Send via WhatsApp
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
