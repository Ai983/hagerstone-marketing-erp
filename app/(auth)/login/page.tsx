"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

async function resolveNextRoute(userId: string) {
  const supabase = createClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return profile ? "/pipeline" : "/onboarding"
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
        setIsCheckingSession(false)
        return
      }

      try {
        const nextRoute = await resolveNextRoute(user.id)
        router.replace(nextRoute)
      } catch {
        setError("Unable to verify your profile right now. Please try again.")
        setIsCheckingSession(false)
      }
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
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Invalid email or password.")
      setIsSubmitting(false)
      return
    }

    try {
      const nextRoute = await resolveNextRoute(data.user.id)
      router.replace(nextRoute)
      router.refresh()
    } catch {
      setError("Login succeeded, but we could not load your profile. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A3C] bg-[#111118] p-8 shadow-[0_0_0_1px_rgba(42,42,60,0.2)]">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Hagerstone International"
            style={{ width: "380px", height: "auto", objectFit: "contain" }}
          />
          <p className="mt-2 text-sm text-[#9090A8]">
            Sign in with your email and password
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm text-[#F0F0FA]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[#F0F0FA]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="Enter your password"
              required
            />
          </div>

          {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || isCheckingSession}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting || isCheckingSession ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <p className="pt-2 text-center text-sm text-[#9090A8]">
            New team member?{" "}
            <Link
              href="/signup"
              className="font-medium text-[#3B82F6] hover:underline"
            >
              Create your account →
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
