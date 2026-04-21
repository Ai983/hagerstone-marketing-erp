"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

export default function OnboardingPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (!user) {
        router.replace("/login")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (profileError) {
        setError("Unable to verify your onboarding status right now.")
        setIsCheckingSession(false)
        return
      }

      if (profile) {
        router.replace("/pipeline")
        return
      }

      setIsCheckingSession(false)
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError("Your session has expired. Please sign in again.")
      setIsSubmitting(false)
      router.replace("/login")
      return
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: fullName.trim(),
      role: "sales_rep",
    })

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
      return
    }

    router.replace("/pipeline")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A3C] bg-[#111118] p-8 shadow-[0_0_0_1px_rgba(42,42,60,0.2)]">
        <div className="mb-8 text-center">
          <p className="font-heading text-3xl font-semibold tracking-tight text-[#F0F0FA]">
            Hagerstone ERP
          </p>
          <p className="mt-2 text-sm text-[#9090A8]">
            Complete your profile to continue
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm text-[#F0F0FA]" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="Enter your full name"
              required
            />
          </div>

          {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || isCheckingSession || !fullName.trim()}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting || isCheckingSession ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
