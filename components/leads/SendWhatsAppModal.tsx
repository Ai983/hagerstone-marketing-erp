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
  leadId,
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
  const [useButtons, setUseButtons] = useState(false)
  const [selectedButtons, setSelectedButtons] = useState<string[]>([])

  const defaultButtons = [
    { id: "btn_interested", title: "Interested ✅", label: "Interested" },
    { id: "btn_not_now", title: "Not Now ❌", label: "Not Now" },
    { id: "btn_call_me", title: "Call Me 📞", label: "Call Me" },
  ]

  // Reset local state when opening with new values
  const handleClose = () => {
    setPhone(leadPhone || "")
    setMessage(prefillMessage ?? "")
    setConsentOverride(false)
    setUseButtons(false)
    setSelectedButtons([])
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
      const buttons =
        useButtons && selectedButtons.length > 0
          ? defaultButtons
              .filter((button) => selectedButtons.includes(button.id))
              .map((button) => ({ id: button.id, title: button.title }))
          : undefined

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          message: message.trim(),
          lead_id: leadId,
          buttons,
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

                  <div className="mt-2">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useButtons"
                        checked={useButtons}
                        onChange={(e) => setUseButtons(e.target.checked)}
                        className="size-3.5 rounded border-[#2A2A3C] accent-[#3B82F6]"
                      />
                      <label
                        htmlFor="useButtons"
                        className="cursor-pointer text-xs text-[#9090A8]"
                      >
                        Add Quick Reply Buttons
                      </label>
                    </div>

                    {useButtons && (
                      <div>
                        <p className="mb-1.5 text-[11px] text-[#5A5A72]">
                          Select buttons to show (max 3):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {defaultButtons.map((button) => {
                            const selected = selectedButtons.includes(button.id)
                            return (
                              <button
                                key={button.id}
                                type="button"
                                onClick={() => {
                                  setSelectedButtons((prev) =>
                                    prev.includes(button.id)
                                      ? prev.filter((id) => id !== button.id)
                                      : prev.length < 3
                                        ? [...prev, button.id]
                                        : prev
                                  )
                                }}
                                className={
                                  selected
                                    ? "rounded-md border border-[#3B82F6] bg-[#3B82F6]/15 px-3 py-1.5 text-xs text-[#3B82F6]"
                                    : "rounded-md border border-[#2A2A3C] bg-[#111118] px-3 py-1.5 text-xs text-[#9090A8]"
                                }
                              >
                                {button.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-1.5 text-[10px] text-[#3A3A52]">
                          Lead can tap one button to reply instantly
                        </p>
                      </div>
                    )}
                  </div>
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
