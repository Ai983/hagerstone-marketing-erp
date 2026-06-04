"use client"

/* eslint-disable @next/next/no-img-element */

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState, type MouseEvent } from "react"

import type { Sector } from "@/lib/portfolio-data"
import { portfolioImage, portfolioMedia } from "@/lib/utils/portfolio-media"

type PortfolioHeroProps = {
  sector: Sector
  leadName?: string
}

type HeroSlide = {
  id: string
  eyebrow: string
  titleStart: string
  titleAccent: string
  sub: string
  metric: string
  metricLabel: string
  image: string
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "delivered",
    eyebrow: "Hagerstone International · Est. 2015",
    titleStart: "500+ Workspaces Delivered Across",
    titleAccent: "India",
    sub: "From concept to handover — turnkey office interiors delivered on time, every time. And if we're late? We pay the penalty.",
    metric: "500+",
    metricLabel: "PROJECTS DELIVERED",
    image: "/portfolio/office-interiors/theon/1.jpg",
  },
  {
    id: "engineered",
    eyebrow: "Design · Build · Deliver",
    titleStart: "Crafted spaces, engineered for",
    titleAccent: "longevity",
    sub: "Office interiors, MEP, facade doors & windows, EPC construction and civil works — handled end-to-end by one trusted team.",
    metric: "15M+",
    metricLabel: "SQ FT DESIGNED",
    image: "/portfolio/office-interiors/msc/1.jpg",
  },
  {
    id: "precision",
    eyebrow: "Trusted by 200+ Clients",
    titleStart: "Built on trust, delivered with",
    titleAccent: "precision",
    sub: "ISO 9001:2015 certified · A+ client rating · operations across 50+ cities pan-India and beyond.",
    metric: "A+",
    metricLabel: "CLIENT RATING",
    image: "/portfolio/office-interiors/oceaneering/1.jpeg",
  },
  {
    id: "next",
    eyebrow: "Your Next Project Starts Here",
    titleStart: "Let's build something",
    titleAccent: "remarkable",
    sub: "Free site visit and consultation — our design team responds within 24 hours, with a tailored proposal for your space.",
    metric: "24h",
    metricLabel: "RESPONSE TIME",
    image: "/portfolio/office-interiors/theon/3.jpg",
  },
]

// Hero background videos — drop MP4 files into /public/portfolio/hero-videos/
// and add their filenames here. Videos play on a loop in sequence: when one
// ends, the next slide starts and its video begins. If a slide has no video
// (fewer videos than slides), it falls back to the slide's `image`.
const HERO_VIDEOS: string[] = [
  "/portfolio/hero-videos/1.mp4",
  "/portfolio/hero-videos/2.mp4",
]

// Fallback advance interval used ONLY when the current slide has no video
// (or its video errored) and is showing a static image instead.
const IMAGE_FALLBACK_MS = 8000

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PortfolioHero(_props: PortfolioHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const [videoErrors, setVideoErrors] = useState<Record<number, boolean>>({})
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  // Drive playback of the underlying <video> elements based on which slide
  // is active. The active video resets to t=0 and plays; the rest are paused.
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return
      if (idx === currentSlide) {
        try {
          video.currentTime = 0
        } catch {
          /* some browsers throw if metadata hasn't loaded yet — ignore */
        }
        const playPromise = video.play()
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            /* autoplay blocked — fallback timer below will still advance */
          })
        }
      } else {
        video.pause()
      }
    })
  }, [currentSlide])

  // Fallback timer — only used when the active slide has no video (or its
  // video errored) and is showing a static image. Videos advance via onEnded.
  useEffect(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    const videoSrc = HERO_VIDEOS.length > 0 ? HERO_VIDEOS[currentSlide % HERO_VIDEOS.length] : null
    const activeSlideUsesVideo = videoSrc && !videoErrors[currentSlide]
    if (activeSlideUsesVideo) return
    fallbackTimerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, IMAGE_FALLBACK_MS)
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [currentSlide, videoErrors])

  const goTo = (idx: number) => setCurrentSlide(idx)
  const next = () => setCurrentSlide((c) => (c + 1) % HERO_SLIDES.length)
  const prev = () => setCurrentSlide((c) => (c - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)

  const handleVideoEnded = (idx: number) => {
    // Only the currently-active video should advance; otherwise inactive
    // videos firing `ended` on loop unmount would race.
    if (idx === currentSlide) next()
  }

  const handleConsultationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleScrollDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const target = document.getElementById("projects") ?? document.querySelector("main > section + section")
    if (target) {
      (target as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" })
    }
  }

  const slide = HERO_SLIDES[currentSlide]
  const titleWords = slide.titleStart.split(" ")

  return (
    <section
      className="relative h-screen min-h-[600px] w-full overflow-hidden bg-[#0F0C08] sm:min-h-[680px]"
    >
      {HERO_SLIDES.map((s, idx) => {
        const isActive = idx === currentSlide
        const videoSrc =
          HERO_VIDEOS.length > 0
            ? HERO_VIDEOS[idx % HERO_VIDEOS.length]
            : null
        const useVideo = videoSrc && !videoErrors[idx]
        return (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
            style={{ opacity: isActive ? 1 : 0 }}
          >
            {useVideo ? (
              <video
                ref={(el) => {
                  videoRefs.current[idx] = el
                }}
                src={videoSrc ? portfolioMedia(videoSrc) : undefined}
                poster={portfolioImage(s.image, { width: 1280, quality: 60 })}
                muted
                playsInline
                autoPlay={isActive}
                preload={isActive ? "auto" : "none"}
                className="absolute inset-0 h-full w-full object-cover"
                onEnded={() => handleVideoEnded(idx)}
                onError={() =>
                  setVideoErrors((p) => ({ ...p, [idx]: true }))
                }
              />
            ) : !imgErrors[idx] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portfolioImage(s.image, { width: 1920, quality: 70 })}
                alt=""
                loading={isActive ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
                onError={() =>
                  setImgErrors((p) => ({ ...p, [idx]: true }))
                }
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, #3A3128 0%, #1A1612 50%, #2B2620 100%)",
                }}
              />
            )}
          </div>
        )
      })}

      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,12,8,0.62) 0%, rgba(15,12,8,0.30) 38%, rgba(15,12,8,0.55) 70%, rgba(15,12,8,0.82) 100%)",
        }}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0F0C08]/75 via-transparent to-[#0F0C08]/45" />
      <div
        className="absolute inset-0 z-[1] opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(232,213,168,0.18) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 80% 50%, black, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 80% 50%, black, transparent 80%)",
        }}
      />


      <div className="port-hero-content relative z-[2] flex h-full items-center px-6 pt-24 md:px-12 lg:px-[8vw]">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 lg:col-start-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                  className="mb-6 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-[#E8D5A8]"
                  style={{
                    textShadow:
                      "0 2px 8px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.35)",
                  }}
                >
                  <span className="h-px w-10 bg-[var(--port-accent-bright)]" />
                  {slide.eyebrow}
                </motion.div>

                <h1
                  className="font-syne text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-[40px] sm:leading-[1.02] md:text-[56px] lg:text-[72px]"
                  style={{
                    textShadow:
                      "0 4px 24px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.45), 0 0 2px rgba(0,0,0,0.30)",
                  }}
                >
                  {titleWords.map((word, idx) => (
                    <motion.span
                      key={`${slide.id}-${word}-${idx}`}
                      className="inline-block"
                      style={{ marginRight: "0.25em" }}
                      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.6, delay: 0.1 + idx * 0.06, ease: [0.4, 0, 0.2, 1] }}
                    >
                      {word}
                    </motion.span>
                  ))}
                  <motion.span
                    className="inline-block"
                    initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.6, delay: 0.1 + titleWords.length * 0.06, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <span className="relative inline-block">
                      <span className="port-serif italic text-[#E8D5A8]">{slide.titleAccent}</span>
                      <svg
                        className="absolute -bottom-2 left-0 w-full"
                        viewBox="0 0 200 12"
                        preserveAspectRatio="none"
                        style={{ height: "10px" }}
                      >
                        <motion.path
                          d="M2,8 Q50,2 100,5 T198,4"
                          stroke="var(--port-accent-bright)"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 1, delay: 0.9, ease: [0.4, 0, 0.2, 1] }}
                        />
                      </svg>
                    </span>
                  </motion.span>
                </h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.55 }}
                  className="mt-8 max-w-[580px] text-[16px] font-light leading-[1.7] text-white/90 md:text-[18px]"
                  style={{
                    textShadow:
                      "0 2px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35)",
                  }}
                >
                  {slide.sub}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.7 }}
                  className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-5"
                >
                  <a
                    href="#contact"
                    onClick={handleConsultationClick}
                    className="group inline-flex min-h-[50px] min-w-[220px] items-center justify-center gap-2.5 rounded-full bg-[#E8D5A8] px-9 py-4 text-[14px] font-semibold tracking-[0.04em] text-[var(--port-ink)] no-underline shadow-[0_8px_24px_rgba(232,213,168,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#FBE9C0] hover:shadow-[0_12px_28px_rgba(232,213,168,0.4)]"
                  >
                    Book a Free Consultation
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                  <a
                    href="https://calendly.com/hagerstone-sales/30min"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[50px] min-w-[180px] items-center justify-center gap-2.5 rounded-full border border-white/35 bg-white/[0.08] px-9 py-4 text-[14px] font-semibold tracking-[0.04em] text-white no-underline backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E8D5A8] hover:bg-[rgba(232,213,168,0.12)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="14" r="1.5" fill="currentColor" />
                    </svg>
                    Book Your Slot
                  </a>

                  <div className="flex w-full items-center gap-4 border-t border-white/15 pt-4 sm:ml-2 sm:w-auto sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                    <div
                      className="font-syne text-[34px] font-bold leading-none text-[#E8D5A8]"
                      style={{
                        textShadow:
                          "0 2px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.40)",
                      }}
                    >
                      {slide.metric}
                    </div>
                    <div
                      className="text-[10px] leading-snug tracking-[0.16em] text-white/70"
                      style={{
                        textShadow:
                          "0 1px 6px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35)",
                      }}
                    >
                      {slide.metricLabel}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="hero-arrow hero-arrow-left group absolute left-3 top-1/2 z-[5] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-white/[0.18] md:left-6 md:h-14 md:w-14 lg:left-[2.5vw]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="hero-arrow hero-arrow-right group absolute right-3 top-1/2 z-[5] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-white/[0.18] md:right-6 md:h-14 md:w-14 lg:right-[2.5vw]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-[4]">
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-7 md:px-12 md:py-8 lg:px-[8vw]">
          <div className="flex items-center gap-3">
            {HERO_SLIDES.map((s, idx) => {
              const isActive = idx === currentSlide
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="group flex h-6 items-center outline-none"
                >
                  <span
                    className="block rounded-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      width: isActive ? 48 : 24,
                      height: 2,
                      background: isActive
                        ? "linear-gradient(90deg, #E8D5A8 0%, #C9A876 100%)"
                        : "rgba(255,255,255,0.28)",
                      boxShadow: isActive
                        ? "0 0 10px rgba(232,213,168,0.55)"
                        : "none",
                    }}
                  />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleScrollDown}
            className="group hidden items-center gap-3 text-white/65 transition-colors duration-300 hover:text-[#E8D5A8] md:flex"
          >
            <span className="text-[10px] tracking-[0.3em]">SCROLL TO EXPLORE</span>
            <span className="block h-px w-12 bg-gradient-to-r from-white/60 to-transparent transition-all duration-300 group-hover:from-[#E8D5A8]" />
            <span className="port-scroll-indicator inline-flex">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
