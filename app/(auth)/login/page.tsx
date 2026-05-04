"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
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
}
@keyframes pulseRing {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50%       { transform: translate(-50%, -50%) scale(1.06); opacity: 0.18; }
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

function LeftPaneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasEl = canvas
    const ctx = canvasEl.getContext("2d")!
    let raf: number
    let W = 0, H = 0

    type Node = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; gold: boolean }
    type Particle = { x: number; y: number; speed: number; dx: number; r: number; life: number; maxLife: number; gold: boolean; alpha: number }

    const nodes: Node[] = []
    const particles: Particle[] = []

    function resize() {
      const rect = canvasEl.getBoundingClientRect()
      W = canvasEl.width = rect.width
      H = canvasEl.height = rect.height
    }

    function mkNode(): Node {
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.5 + 0.12,
        gold: Math.random() < 0.25,
      }
    }

    function mkParticle(fromBottom = true): Particle {
      return {
        x: Math.random() * W,
        y: fromBottom ? H + 6 : Math.random() * H,
        speed: Math.random() * 0.4 + 0.12,
        dx: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.3,
        life: fromBottom ? 0 : Math.floor(Math.random() * 260),
        maxLife: Math.random() * 260 + 160,
        gold: Math.random() < 0.28,
        alpha: 0,
      }
    }

    resize()
    for (let i = 0; i < 24; i++) nodes.push(mkNode())
    for (let i = 0; i < 40; i++) particles.push(mkParticle(false))

    const ro = new ResizeObserver(resize)
    ro.observe(canvasEl)

    function draw() {
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 140) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(59,130,246,${0.08 * (1 - d / 140)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      for (const nd of nodes) {
        nd.x += nd.vx; nd.y += nd.vy
        if (nd.x < 0 || nd.x > W) nd.vx *= -1
        if (nd.y < 0 || nd.y > H) nd.vy *= -1
        ctx.beginPath()
        ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2)
        ctx.fillStyle = nd.gold ? `rgba(212,175,55,${nd.alpha})` : `rgba(59,130,246,${nd.alpha})`
        ctx.fill()
      }
      for (let k = 0; k < particles.length; k++) {
        const p = particles[k]
        p.life++; p.y -= p.speed; p.x += p.dx
        const prog = p.life / p.maxLife
        p.alpha = (prog < 0.12 ? prog / 0.12 : prog > 0.8 ? (1 - prog) / 0.2 : 1) * 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.gold ? `rgba(212,175,55,${p.alpha})` : `rgba(59,130,246,${p.alpha})`
        ctx.fill()
        if (p.life >= p.maxLife) particles[k] = mkParticle(true)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
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

      <section className="relative z-10 flex w-full flex-col justify-center overflow-hidden md:w-1/2">
        <div className="absolute inset-0 bg-[#0A0A12]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.07) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <LeftPaneCanvas />
        {[260, 420, 580].map((size, i) => (
          <div
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              width: size, height: size,
              top: "50%", left: "50%",
              border: `1px solid rgba(59,130,246,${0.08 - i * 0.02})`,
              animation: `pulseRing 4.5s ease-in-out ${i * 1.5}s infinite`,
            }}
          />
        ))}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 85% at 50% 50%, transparent 30%, #0A0A12 100%)" }}
        />
        {(["top-4 left-4 border-t border-l","top-4 right-4 border-t border-r","bottom-4 left-4 border-b border-l","bottom-4 right-4 border-b border-r"] as const).map((cls, i) => (
          <div key={i} className={`pointer-events-none absolute h-5 w-5 ${cls}`} style={{ borderColor: "rgba(59,130,246,0.3)" }} />
        ))}
        <div className="relative z-10 mx-auto w-full px-8 py-12 sm:px-12" style={{ maxWidth: 460 }}>
          <img
            src="/logo.png"
            alt="Hagerstone International"
            className="mb-3 h-auto object-contain"
            style={{ width: 260 }}
          />
          <h1 className="font-[family-name:var(--font-heading)] text-[34px] font-bold leading-tight text-[#F0F0FA] sm:text-[38px]">
            Welcome back <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-[15px] text-[#9090A8]">Sign in to Hagerstone Marketing ERP</p>
          <div className="mb-7 mt-6 h-px w-16" style={{ background: "rgba(59,130,246,0.4)" }} />
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9090A8]">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A72]" />
                <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@hagerstone.com" className="h-12 w-full rounded-[10px] border border-[#2A2A3C] bg-[#1F1F2E] pl-10 pr-3 text-[15px] text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6] focus:bg-[#1A1A2E]" />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9090A8]">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A72]" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" className="h-12 w-full rounded-[10px] border border-[#2A2A3C] bg-[#1F1F2E] pl-10 pr-11 text-[15px] text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6] focus:bg-[#1A1A2E]" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1} className="absolute right-3 top-1/2 rounded p-1 text-[#9090A8] transition hover:text-[#F0F0FA]" style={{ transform: "translateY(-50%)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error ? <p className="text-sm text-[#F87171]">{error}</p> : null}
            <motion.button type="submit" disabled={isSubmitting || isCheckingSession} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#3B82F6] text-[15px] font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70" style={{ boxShadow: "0 4px 20px rgba(59,130,246,0.28)" }}>
              {isSubmitting || isCheckingSession ? (
                <><Loader2 className="size-4 animate-spin" />Signing in...</>
              ) : (
                <>Sign in<ArrowRight size={16} /></>
              )}
            </motion.button>
            <div className="pt-1 text-center">
              <span className="text-[13px] text-[#5A5A72]">New sales rep? </span>
              <Link href="/signup" className="text-[13px] font-medium text-[#3B82F6] no-underline hover:underline">Create an account</Link>
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
