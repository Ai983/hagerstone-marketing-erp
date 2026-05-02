"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { toast } from "sonner"

import { HagerstoneLogoAnimation } from "@/components/ui/HagerstoneLogoAnimation"
import { createClient } from "@/lib/supabase/client"

const QUOTES = [
  {
    headline: "Close more deals.",
    sub: "Turn leads into revenue, faster.",
  },
  {
    headline: "Know your pipeline.",
    sub: "Real-time visibility across every stage.",
  },
  {
    headline: "Build better relationships.",
    sub: "Every interaction tracked, nothing missed.",
  },
] as const

const GRADIENT_BG =
  "linear-gradient(-45deg, #0F1729, #1A1A4E, #0D2137, #1A0A2E, #0A1F3D, #162040)"

const GRADIENT_KEYFRAMES = `
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`

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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted) return

      if (!user) {
        setIsCheckingSession(false)
        return
      }

      try {
        const nextRoute = await resolveNextRoute(user.id)
        router.replace(nextRoute)
      } catch (err) {
        console.error("Login session profile check failed:", err)
        const message = "Unable to verify your profile right now. Please try again."
        setError(message)
        toast.error(message)
        setIsCheckingSession(false)
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % QUOTES.length)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (signInError || !data.user) {
        const message = signInError?.message ?? "Invalid email or password."
        setError(message)
        toast.error(message)
        setIsSubmitting(false)
        return
      }

      const nextRoute = await resolveNextRoute(data.user.id)
      router.replace(nextRoute)
      router.refresh()
    } catch (err) {
      console.error("Login failed:", err)
      const message =
        err instanceof Error
          ? err.message
          : "Login succeeded, but we could not load your profile. Please try again."
      setError(message)
      toast.error(message)
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen bg-[#0A0A0F]">
      <style dangerouslySetInnerHTML={{ __html: GRADIENT_KEYFRAMES }} />

      <div
        className="pointer-events-none absolute inset-0 opacity-30 md:hidden"
        style={{
          background: GRADIENT_BG,
          backgroundSize: "400% 400%",
          animation: "gradientShift 8s ease infinite",
        }}
      />

      <section className="relative z-10 flex w-full flex-col justify-center px-6 py-10 sm:px-10 md:w-1/2 md:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Hagerstone International"
            className="mb-1 h-auto w-[240px] object-contain sm:w-[280px]"
          />

          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[#F0F0FA] sm:text-[32px]">
            Welcome back <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-sm text-[#9090A8]">
            Sign in to Hagerstone Marketing ERP
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9090A8]"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A72]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="name@hagerstone.com"
                  className="h-12 w-full rounded-[10px] border border-[#2A2A3C] bg-[#1F1F2E] pl-10 pr-3 text-[15px] text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9090A8]"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A72]"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-12 w-full rounded-[10px] border border-[#2A2A3C] bg-[#1F1F2E] pl-10 pr-11 text-[15px] text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 rounded p-1 text-[#9090A8] transition hover:text-[#F0F0FA]"
                  style={{ transform: "translateY(-50%)" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}

            <motion.button
              type="submit"
              disabled={isSubmitting || isCheckingSession}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#3B82F6] text-[15px] font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting || isCheckingSession ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>

            <div className="pt-2 text-center">
              <span className="text-[13px] text-[#5A5A72]">
                New sales rep?{" "}
              </span>
              <Link
                href="/signup"
                className="text-[13px] font-medium text-[#3B82F6] no-underline hover:underline"
              >
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </section>

      <aside className="relative hidden w-1/2 overflow-hidden md:block">
        <div
          className="absolute inset-0"
          style={{
            background: GRADIENT_BG,
            backgroundSize: "400% 400%",
            animation: "gradientShift 8s ease infinite",
          }}
        />

        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            top: "10%",
            left: "10%",
            width: 300,
            height: 300,
            background:
              "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            bottom: "20%",
            right: "10%",
            width: 250,
            height: 250,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
          animate={{ x: [0, -25, 15, 0], y: [0, 30, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            top: "50%",
            left: "40%",
            width: 200,
            height: 200,
            background:
              "radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)",
            filter: "blur(35px)",
          }}
          animate={{ x: [0, 20, -15, 0], y: [0, -20, 25, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="absolute left-1/2 top-1/2 z-10 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-8 text-center">
          <div className="mb-8 flex justify-center">
            <HagerstoneLogoAnimation size={260} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-[family-name:var(--font-heading)] text-[36px] font-bold leading-tight text-white">
                {QUOTES[quoteIndex].headline}
              </h2>
              <p className="mt-3 text-base text-white/70">
                {QUOTES[quoteIndex].sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.15em] text-white/40">
          HAGERSTONE · ERP · POWERED BY AI
        </p>
      </aside>
    </main>
  )
}
