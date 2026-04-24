"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Lock } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type PasswordStrength = "weak" | "fair" | "good" | "strong"

function getStrength(pw: string): {
  level: PasswordStrength
  score: number
  label: string
  color: string
} {
  let score = 0
  if (pw.length >= 8) score += 1
  if (pw.length >= 12) score += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw)) score += 1

  if (pw.length === 0) {
    return { level: "weak", score: 0, label: "", color: "#2A2A3C" }
  }
  if (score <= 1) return { level: "weak", score, label: "Weak", color: "#F87171" }
  if (score === 2) return { level: "fair", score, label: "Fair", color: "#F59E0B" }
  if (score === 3) return { level: "good", score, label: "Good", color: "#60A5FA" }
  return { level: "strong", score, label: "Strong", color: "#34D399" }
}

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Redirect already-signed-in users away from /signup
  useEffect(() => {
    let mounted = true
    const check = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!mounted) return
      if (user) {
        router.replace("/pipeline")
        return
      }
      setIsCheckingSession(false)
    }
    check()
    return () => {
      mounted = false
    }
  }, [router])

  const strength = useMemo(() => getStrength(password), [password])
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!fullName.trim()) return setError("Full name is required")
    if (!email.trim()) return setError("Email is required")
    if (!phone.trim()) return setError("Phone number is required")
    if (password.length < 8)
      return setError("Password must be at least 8 characters")
    if (password !== confirmPassword)
      return setError("Passwords do not match")

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to create account")
        setIsSubmitting(false)
        return
      }

      setSuccessMessage(
        "Account created! Please wait for admin to assign leads to you. You can now sign in."
      )
      setTimeout(() => router.push("/login"), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
      setIsSubmitting(false)
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A3C] bg-[#111118] p-8 shadow-[0_0_0_1px_rgba(42,42,60,0.2)]">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Hagerstone International"
            style={{ width: "260px", height: "auto", objectFit: "contain" }}
          />
          <p className="mt-2 text-sm text-[#9090A8]">
            Create your sales rep account
          </p>
        </div>

        {successMessage ? (
          <div className="rounded-xl border border-[#34D399]/40 bg-[#163322]/60 p-4 text-sm text-[#34D399]">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{successMessage}</p>
                <p className="mt-1 text-xs text-[#34D399]/80">
                  Redirecting to sign in…
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Role badge — not a form field, purely informational */}
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: "#3B82F620",
                borderColor: "#3B82F6",
                color: "#3B82F6",
              }}
            >
              <Lock className="size-3.5" />
              <span>Role: Sales Rep (Fixed)</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#F0F0FA]" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                placeholder="e.g. Rohit Sharma"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#F0F0FA]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#F0F0FA]" htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#F0F0FA]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                placeholder="At least 8 characters"
              />

              {/* Strength bar */}
              <div className="flex items-center gap-2">
                <div className="flex h-1 flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor:
                          password.length > 0 && i < strength.score
                            ? strength.color
                            : "#2A2A3C",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="w-12 text-right text-[11px] font-medium"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm text-[#F0F0FA]"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={cn(
                  "h-11 w-full rounded-lg border bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:ring-2",
                  passwordsMismatch
                    ? "border-[#F87171] focus:border-[#F87171] focus:ring-[#F87171]/20"
                    : "border-[#3A3A52] focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                )}
                placeholder="Re-enter password"
              />
              {passwordsMismatch && (
                <p className="text-xs text-[#F87171]">Passwords do not match</p>
              )}
            </div>

            {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>

            <p className="pt-2 text-center text-sm text-[#9090A8]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-[#3B82F6] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
