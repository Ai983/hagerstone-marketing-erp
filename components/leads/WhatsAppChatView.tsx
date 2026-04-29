"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Phone, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"

interface WhatsAppMessage {
  id: string
  type: "whatsapp_sent" | "whatsapp_received"
  notes: string | null
  created_at: string
  is_automated: boolean
  user: { full_name: string } | null
}

interface RawWhatsAppMessage {
  id: string
  type: "whatsapp_sent" | "whatsapp_received"
  notes: string | null
  created_at: string
  is_automated: boolean
  user: { full_name: string }[] | { full_name: string } | null
}

interface Props {
  lead: {
    id: string
    full_name: string
    phone: string
    whatsapp_opted_in: boolean
  }
}

export function WhatsAppChatView({ lead }: Props) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("interactions")
      .select(
        "id, type, notes, created_at, is_automated, user:user_id(full_name)"
      )
      .eq("lead_id", lead.id)
      .in("type", ["whatsapp_sent", "whatsapp_received"])
      .order("created_at", { ascending: true })

    if (error) {
      console.error("fetch whatsapp messages failed:", error)
      toast.error("Failed to load WhatsApp messages")
      setLoading(false)
      return
    }

    const normalized = ((data ?? []) as RawWhatsAppMessage[]).map((message) => ({
      ...message,
      user: Array.isArray(message.user)
        ? (message.user[0] ?? null)
        : (message.user ?? null),
    }))

    setMessages(normalized)
    setLoading(false)
  }, [lead.id])

  useEffect(() => {
    fetchMessages()

    const supabase = createClient()
    const channel = supabase
      .channel(`whatsapp-${lead.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interactions",
          filter: `lead_id=eq.${lead.id}`,
        },
        (payload) => {
          const next = payload.new as { type?: string }
          if (
            next.type === "whatsapp_sent" ||
            next.type === "whatsapp_received"
          ) {
            fetchMessages()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMessages, lead.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead.phone,
          message: newMessage,
          lead_id: lead.id,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setNewMessage("")
      toast.success("Message sent!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const groupedMessages = messages.reduce(
    (groups, msg) => {
      const date = format(new Date(msg.created_at), "dd MMM yyyy")
      if (!groups[date]) groups[date] = []
      groups[date].push(msg)
      return groups
    },
    {} as Record<string, WhatsAppMessage[]>
  )

  return (
    <div className="flex h-full flex-col bg-[#0A0A0F]">
      <div className="flex items-center justify-between border-b border-[#2A2A3C] bg-[#111118] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#10B98140] bg-[#10B98120] text-sm font-semibold text-[#10B981]">
            {lead.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="m-0 text-[13px] font-medium text-[#F0F0FA]">
              {lead.full_name}
            </p>
            <p className="m-0 text-[11px] text-[#9090A8]">{lead.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMessages}
            className="rounded p-1 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center rounded p-1 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
            title="Call"
          >
            <Phone className="size-3.5" />
          </a>
        </div>
      </div>

      {!lead.whatsapp_opted_in && (
        <div className="mx-3 mt-2 rounded-md border border-[#F59E0B40] bg-[#78350F20] px-3 py-2 text-[11px] text-[#F59E0B]">
          Lead has not opted in to WhatsApp messages
        </div>
      )}

      <div className="thin-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-2 h-10 rounded-lg bg-[#1A1A24] opacity-50"
              style={{
                width: i % 2 === 0 ? "60%" : "70%",
                alignSelf: i % 2 === 0 ? "flex-end" : "flex-start",
              }}
            />
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 pt-10 text-center text-[13px] text-[#5A5A72]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A24]">
              <Send className="size-5 text-[#5A5A72]" />
            </div>
            <p className="m-0">No WhatsApp messages yet</p>
            <p className="m-0 text-[11px] text-[#3A3A52]">
              Send the first message below
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="my-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[#2A2A3C]" />
                <span className="rounded-full bg-[#1A1A24] px-2 py-0.5 text-[10px] text-[#5A5A72]">
                  {date}
                </span>
                <div className="h-px flex-1 bg-[#2A2A3C]" />
              </div>

              {msgs.map((msg) => {
                const isSent = msg.type === "whatsapp_sent"

                return (
                  <div
                    key={msg.id}
                    className={`mb-1 flex ${isSent ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] border px-3 py-2 ${
                        isSent
                          ? "rounded-[12px_12px_2px_12px] border-[#10B98130] bg-[#054640]"
                          : "rounded-[12px_12px_12px_2px] border-[#2A2A3C] bg-[#1A1A24]"
                      }`}
                    >
                      {isSent && msg.user?.full_name && (
                        <p className="m-0 mb-1 text-[10px] font-medium text-[#10B981]">
                          {msg.is_automated ? "Campaign" : msg.user.full_name}
                        </p>
                      )}
                      {!isSent && (
                        <p className="m-0 mb-1 text-[10px] font-medium text-[#3B82F6]">
                          {lead.full_name}
                        </p>
                      )}

                      <p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-[#F0F0FA]">
                        {msg.notes || ""}
                      </p>

                      <p className="m-0 mt-1 text-right text-[10px] text-[#5A5A72]">
                        {format(new Date(msg.created_at), "hh:mm a")}
                        {isSent ? " ✓✓" : ""}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-[#2A2A3C] bg-[#111118] px-3 py-2.5">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="thin-scrollbar max-h-[100px] flex-1 resize-none overflow-y-auto rounded-full border border-[#2A2A3C] bg-[#1F1F2E] px-3.5 py-2 text-[13px] leading-[1.5] text-[#F0F0FA] outline-none placeholder:text-[#9090A8]"
          style={{ fontFamily: "DM Sans, sans-serif" }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition ${
            newMessage.trim()
              ? "bg-[#10B981]"
              : "cursor-not-allowed bg-[#1A1A24]"
          }`}
        >
          {sending ? (
            <div className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send
              className={`size-[15px] ${newMessage.trim() ? "text-white" : "text-[#5A5A72]"}`}
            />
          )}
        </button>
      </div>
    </div>
  )
}
