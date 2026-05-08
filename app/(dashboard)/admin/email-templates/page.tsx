"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Edit, Loader2, Mail, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"

type Category =
  | "general"
  | "follow_up"
  | "proposal"
  | "site_visit"
  | "negotiation"
  | "welcome"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  category: Category
}

const categories: Category[] = [
  "general",
  "follow_up",
  "proposal",
  "site_visit",
  "negotiation",
  "welcome",
]

const variables = [
  "{{lead_name}}",
  "{{rep_name}}",
  "{{company_name}}",
  "{{service_line}}",
  "{{visit_date}}",
  "{{city}}",
]

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function categoryClass(category: Category) {
  if (category === "follow_up") return "bg-[#1E3A5F] text-[#60A5FA]"
  if (category === "proposal") return "bg-[#123A34] text-[#34D399]"
  if (category === "site_visit") return "bg-[#3A2413] text-[#FB923C]"
  if (category === "negotiation") return "bg-[#2E1A47] text-[#C084FC]"
  if (category === "welcome") return "bg-[#163322] text-[#86EFAC]"
  return "bg-[#1A1A24] text-[#C7C7D8]"
}

export default function EmailTemplatesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    getCachedUserAndProfile().then(({ user, profile }) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const role = profile?.role as string | undefined
      if (!role || !["admin", "manager", "marketing"].includes(role)) {
        router.replace("/activities")
        return
      }
      setCheckingAccess(false)
    })
  }, [router])

  const templatesQuery = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load templates")
      return data.templates as EmailTemplate[]
    },
    enabled: !checkingAccess,
  })

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/email/templates/${templateId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
    },
    onSuccess: () => {
      toast.success("Template deleted")
      queryClient.invalidateQueries({ queryKey: ["email-templates"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const res = await fetch("/api/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} Copy`,
          subject: template.subject,
          body_html: template.body_html,
          category: template.category,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Duplicate failed")
    },
    onSuccess: () => {
      toast.success("Template duplicated")
      queryClient.invalidateQueries({ queryKey: ["email-templates"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Duplicate failed")
    },
  })

  if (checkingAccess) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  if (isCreating || editing) {
    return (
      <TemplateForm
        template={editing}
        onCancel={() => {
          setIsCreating(false)
          setEditing(null)
        }}
        onSaved={() => {
          setIsCreating(false)
          setEditing(null)
          queryClient.invalidateQueries({ queryKey: ["email-templates"] })
        }}
      />
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              Email Templates
            </h1>
            <p className="mt-0.5 text-sm text-[#9090A8]">
              Create reusable email templates for lead follow-up.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white transition hover:bg-[#2563EB]"
          >
            <Plus className="size-4" />
            New Template
          </button>
        </div>

        {templatesQuery.isLoading ? (
          <div className="flex h-60 items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118]">
            <Loader2 className="size-6 animate-spin text-[#9090A8]" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(templatesQuery.data ?? []).map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#F0F0FA]">
                      {template.name}
                    </h2>
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        categoryClass(template.category)
                      )}
                    >
                      {template.category.replace("_", " ")}
                    </span>
                  </div>
                  <Mail className="size-5 shrink-0 text-[#3B82F6]" />
                </div>
                <p className="mt-4 truncate text-sm font-medium text-[#F0F0FA]">
                  {template.subject}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-[#9090A8]">
                  {stripHtml(template.body_html).slice(0, 100)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <IconButton label="Edit" icon={Edit} onClick={() => setEditing(template)} />
                  <IconButton
                    label="Duplicate"
                    icon={Copy}
                    onClick={() => duplicateMutation.mutate(template)}
                  />
                  <IconButton
                    label="Delete"
                    icon={Trash2}
                    danger
                    onClick={() => deleteMutation.mutate(template.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function IconButton({
  label,
  icon: Icon,
  danger,
  onClick,
}: {
  label: string
  icon: typeof Edit
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium transition hover:bg-[#1F1F2E]",
        danger ? "text-[#F87171]" : "text-[#F0F0FA]"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function TemplateForm({
  template,
  onCancel,
  onSaved,
}: {
  template: EmailTemplate | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(template?.name ?? "")
  const [category, setCategory] = useState<Category>(template?.category ?? "general")
  const [subject, setSubject] = useState(template?.subject ?? "")
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? "")
  const [saving, setSaving] = useState(false)

  const bodySnippet = useMemo(() => stripHtml(bodyHtml), [bodyHtml])

  const insertVariable = (variable: string) => {
    setBodyHtml((prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${variable}`)
  }

  const save = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Name, subject and body are required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        template ? `/api/email/templates/${template.id}` : "/api/email/templates",
        {
          method: template ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category,
            subject: subject.trim(),
            body_html: bodyHtml.trim(),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast.success("Template saved")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              {template ? "Edit Template" : "New Template"}
            </h1>
            <p className="text-sm text-[#9090A8]">
              Write HTML-supported email content with merge variables.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-9 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
            <div className="grid gap-4">
              <TextInput label="Name" value={name} onChange={setName} />
              <label>
                <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
                  Category
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput label="Subject" value={subject} onChange={setSubject} />
              <label>
                <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
                  Body HTML
                </span>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-lg border border-[#2A2A3C] px-4 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">
                Variable Guide
              </h2>
              <p className="mb-3 text-xs text-[#9090A8]">
                Click to insert variable into body
              </p>
              <div className="flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-2 py-1 text-xs text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">Preview</h2>
              <p className="mb-3 text-xs font-medium text-[#F0F0FA]">{subject || "No subject"}</p>
              <div
                className="rounded-lg bg-white p-4 text-sm leading-relaxed text-gray-900"
                dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>No body yet.</p>" }}
              />
              {!bodyHtml && <p className="mt-2 text-xs text-[#9090A8]">{bodySnippet}</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
      />
    </label>
  )
}
