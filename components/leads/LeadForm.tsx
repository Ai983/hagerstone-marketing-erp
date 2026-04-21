"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { createClient } from "@/lib/supabase/client"
import { useLeads, type CreateLeadInput, type DuplicateLeadMatch } from "@/lib/hooks/useLeads"
import { cn } from "@/lib/utils"

const companySizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"] as const
const serviceLineOptions = [
  { label: "Office Interiors", value: "office_interiors" },
  { label: "MEP", value: "mep" },
  { label: "Facade & Glazing", value: "facade_glazing" },
  { label: "PEB Construction", value: "peb_construction" },
  { label: "Civil Works", value: "civil_works" },
  { label: "Multiple", value: "multiple" },
  { label: "Unknown", value: "unknown" },
] as const
const sourceOptions = [
  { label: "Website", value: "website" },
  { label: "Manual Sales", value: "manual_sales" },
  { label: "WhatsApp Inbound", value: "whatsapp_inbound" },
  { label: "Referral", value: "referral" },
  { label: "Google Ads", value: "google_ads" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "JustDial", value: "justdial" },
  { label: "Other", value: "other" },
] as const

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

const leadFormSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required.")
    .refine((value) => value.replace(/\D/g, "").length >= 10, {
      message: "Phone must be at least 10 digits.",
    }),
  phone_alt: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email("Enter a valid email address.").optional()
  ),
  designation: z.preprocess(emptyToUndefined, z.string().optional()),
  company_name: z.preprocess(emptyToUndefined, z.string().optional()),
  company_size: z.preprocess(emptyToUndefined, z.enum(companySizeOptions).optional()),
  industry: z.preprocess(emptyToUndefined, z.string().optional()),
  city: z.preprocess(emptyToUndefined, z.string().optional()),
  state: z.string().trim().default("Delhi NCR"),
  service_line: z.preprocess(
    emptyToUndefined,
    z.enum(serviceLineOptions.map((option) => option.value) as [string, ...string[]]).optional()
  ),
  estimated_budget: z.preprocess(emptyToUndefined, z.string().optional()),
  project_size_sqft: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
    return Number(value)
  }, z.number().positive("Project size must be a positive number.").optional()),
  expected_timeline: z.preprocess(emptyToUndefined, z.string().optional()),
  source: z.enum(sourceOptions.map((option) => option.value) as [string, ...string[]]),
  referral_name: z.preprocess(emptyToUndefined, z.string().optional()),
  whatsapp_opted_in: z.boolean(),
  initial_notes: z.preprocess(emptyToUndefined, z.string().optional()),
})

type LeadFormValues = z.infer<typeof leadFormSchema>
type LeadFormInput = z.input<typeof leadFormSchema>

const sectionClasses = "rounded-xl border border-[#2A2A3C] bg-[#111118] p-6"
const labelClasses =
  "mb-2 block text-[12px] uppercase tracking-[0.05em] text-[#9090A8]"
const inputClasses =
  "h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
const selectClasses = inputClasses
const textareaClasses =
  "w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[12px] uppercase tracking-[0.12em] text-[#9090A8]">{children}</p>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs text-[#F87171]">{message}</p> : null
}

interface LeadFormProps {
  /**
   * If provided, the form calls this instead of navigating to the new
   * lead's detail page. Used when the form is rendered inside a modal.
   */
  onSuccess?: (leadId: string) => void
}

export function LeadForm({ onSuccess }: LeadFormProps = {}) {
  const router = useRouter()
  const { createLead, checkDuplicate, getStageBySlug } = useLeads()
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicateLead, setDuplicateLead] = useState<DuplicateLeadMatch | null>(null)
  const [pendingLeadData, setPendingLeadData] = useState<CreateLeadInput | null>(null)
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      phone_alt: "",
      email: "",
      designation: "",
      company_name: "",
      company_size: undefined,
      industry: "",
      city: "",
      state: "Delhi NCR",
      service_line: undefined,
      estimated_budget: "",
      project_size_sqft: undefined,
      expected_timeline: "",
      source: "manual_sales",
      referral_name: "",
      whatsapp_opted_in: false,
      initial_notes: "",
    },
  })

  const selectedSource = watch("source")
  const isReferral = selectedSource === "referral"

  const duplicateSummary = useMemo(() => {
    if (!duplicateLead) {
      return null
    }

    const company = duplicateLead.company_name ? ` at ${duplicateLead.company_name}` : ""
    const stage = duplicateLead.stage?.name ? ` in stage ${duplicateLead.stage.name}` : ""
    return `A lead with this phone already exists: ${duplicateLead.full_name}${company}${stage}. Do you want to continue creating a new lead anyway?`
  }, [duplicateLead])

  const persistLead = async (data: CreateLeadInput) => {
    setFormError(null)
    setIsSubmittingLead(true)

    try {
      const lead = await createLead(data)
      // Fire-and-forget initial scoring (don't block navigation on it)
      fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      }).catch(() => {
        // scoring failure shouldn't block lead creation UX
      })
      // Lead-assignment notification is handled by the Supabase DB trigger
      // on the leads table — do not insert it here or it will duplicate.
      toast.success("Lead created successfully")

      if (onSuccess) {
        // Modal path — let the caller decide what to do (close + invalidate).
        onSuccess(lead.id)
      } else {
        // Standalone page path — navigate to the new lead's detail page.
        router.push(`/leads/${lead.id}`)
        router.refresh()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create lead right now."
      setFormError(message)
    } finally {
      setIsSubmittingLead(false)
    }
  }

  const onSubmit = async (values: LeadFormValues) => {
    setFormError(null)
    setDuplicateLead(null)
    setPendingLeadData(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setFormError("Your session has expired. Please sign in again.")
        return
      }

      const stage = await getStageBySlug("new_lead")
      if (!stage) {
        setFormError("The default New Lead stage could not be found.")
        return
      }

      const leadPayload: CreateLeadInput = {
        ...values,
        referral_name: values.source === "referral" ? values.referral_name : undefined,
        stage_id: stage.id,
        created_by: user.id,
        assigned_to: user.id,
      }

      const duplicate = await checkDuplicate(values.phone)
      if (duplicate) {
        setDuplicateLead(duplicate)
        setPendingLeadData(leadPayload)
        return
      }

      await persistLead(leadPayload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to validate this lead right now."
      setFormError(message)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8">
      <Link
        href="/leads"
        className="inline-flex items-center text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
      >
        ← All Leads
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-[#F0F0FA]">
          New Lead
        </h1>
        <p className="mt-2 text-sm text-[#9090A8]">
          Add a lead manually to start tracking it in the pipeline.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {duplicateSummary ? (
          <div className="rounded-xl border border-[#7C4A15] bg-[#2A1B0D] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#F59E0B]" />
              <div className="flex-1">
                <p className="text-sm text-[#F0F0FA]">{duplicateSummary}</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateLead(null)
                      setPendingLeadData(null)
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-4 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => pendingLeadData && persistLead(pendingLeadData)}
                    disabled={!pendingLeadData || isSubmittingLead}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmittingLead ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {formError ? (
          <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1215] px-4 py-3 text-sm text-[#F87171]">
            {formError}
          </div>
        ) : null}

        <section className={sectionClasses}>
          <SectionHeading>Section 1 — Contact Info</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>Full Name</label>
              <input {...register("full_name")} className={inputClasses} />
              <FieldError message={errors.full_name?.message} />
            </div>
            <div>
              <label className={labelClasses}>Phone</label>
              <input {...register("phone")} className={inputClasses} />
              <FieldError message={errors.phone?.message} />
            </div>
            <div>
              <label className={labelClasses}>Alternate Phone</label>
              <input {...register("phone_alt")} className={inputClasses} />
              <FieldError message={errors.phone_alt?.message} />
            </div>
            <div>
              <label className={labelClasses}>Email</label>
              <input type="email" {...register("email")} className={inputClasses} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Designation</label>
              <input {...register("designation")} className={inputClasses} />
              <FieldError message={errors.designation?.message} />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionHeading>Section 2 — Company Info</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>Company Name</label>
              <input {...register("company_name")} className={inputClasses} />
              <FieldError message={errors.company_name?.message} />
            </div>
            <div>
              <label className={labelClasses}>Company Size</label>
              <select {...register("company_size")} className={selectClasses} defaultValue="">
                <option value="">Select company size</option>
                {companySizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <FieldError message={errors.company_size?.message} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Industry</label>
              <input {...register("industry")} className={inputClasses} />
              <FieldError message={errors.industry?.message} />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionHeading>Section 3 — Location</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>City</label>
              <input {...register("city")} className={inputClasses} />
              <FieldError message={errors.city?.message} />
            </div>
            <div>
              <label className={labelClasses}>State</label>
              <input {...register("state")} className={inputClasses} />
              <FieldError message={errors.state?.message} />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionHeading>Section 4 — Service Interest</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>Service Line</label>
              <select {...register("service_line")} className={selectClasses} defaultValue="">
                <option value="">Select service line</option>
                {serviceLineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.service_line?.message} />
            </div>
            <div>
              <label className={labelClasses}>Estimated Budget</label>
              <input
                {...register("estimated_budget")}
                className={inputClasses}
                placeholder="e.g. ₹50L–₹1Cr"
              />
              <FieldError message={errors.estimated_budget?.message} />
            </div>
            <div>
              <label className={labelClasses}>Project Size (sqft)</label>
              <input
                type="number"
                {...register("project_size_sqft")}
                className={inputClasses}
              />
              <FieldError message={errors.project_size_sqft?.message} />
            </div>
            <div>
              <label className={labelClasses}>Expected Timeline</label>
              <input
                {...register("expected_timeline")}
                className={inputClasses}
                placeholder="e.g. Q3 2025"
              />
              <FieldError message={errors.expected_timeline?.message} />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <SectionHeading>Section 5 — Source & Notes</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>Source</label>
              <select {...register("source")} className={selectClasses}>
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.source?.message} />
            </div>

            {isReferral ? (
              <div>
                <label className={labelClasses}>Referral Name</label>
                <input {...register("referral_name")} className={inputClasses} />
                <FieldError message={errors.referral_name?.message} />
              </div>
            ) : (
              <div />
            )}

            <div className={cn("md:col-span-2", isReferral ? "" : "md:col-span-2")}>
              <label className="flex items-center gap-3 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-3 text-sm text-[#F0F0FA]">
                <input
                  type="checkbox"
                  {...register("whatsapp_opted_in")}
                  className="size-4 rounded border-[#3A3A52] bg-[#1F1F2E] accent-[#3B82F6]"
                />
                <span>Lead has consented to WhatsApp messages</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className={labelClasses}>Initial Notes</label>
              <textarea
                {...register("initial_notes")}
                rows={4}
                className={textareaClasses}
              />
              <FieldError message={errors.initial_notes?.message} />
            </div>
          </div>
        </section>

        <div className="flex justify-stretch sm:justify-end">
          <button
            type="submit"
            disabled={isSubmittingLead}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-5 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isSubmittingLead ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating lead...
              </>
            ) : (
              "Create Lead"
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
