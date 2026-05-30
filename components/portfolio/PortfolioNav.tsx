"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import { portfolioMedia } from "@/lib/utils/portfolio-media"

const NAV_LINKS = [
  { label: "Work", href: "#projects" },
  { label: "Process", href: "#process" },
  { label: "Why Us", href: "#why" },
  { label: "Testimonials", href: "#testimonials" },
]

export function PortfolioNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      event.preventDefault()
      const id = href.slice(1)
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
      setIsMobileOpen(false)
    }
  }

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
      className="fixed left-0 right-0 top-0 z-[1000]"
      style={{
        background: isScrolled ? "rgba(251,249,244,0.92)" : "transparent",
        backdropFilter: isScrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: isScrolled ? "blur(24px) saturate(180%)" : "none",
        borderBottom: isScrolled ? "1px solid rgba(232,226,210,0.65)" : "1px solid transparent",
        boxShadow: isScrolled
          ? "0 6px 24px rgba(26,22,18,0.06)"
          : "none",
        transition: "all 300ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        className="flex items-center justify-between px-6 md:px-12 lg:px-[8vw]"
        style={{ height: isScrolled ? 64 : 76, transition: "height 300ms cubic-bezier(0.4,0,0.2,1)" }}
      >
        <a href="/portfolio" aria-label="Hagerstone portfolio home" className="block no-underline group">
          <div className="flex items-center gap-3">
            <img
              src={portfolioMedia("/portfolio/hagerstone-logo.png")}
              alt="Hagerstone International"
              className={`block w-auto transition-[height] duration-300 ${
                isScrolled ? "h-[40px] sm:h-[52px]" : "h-[46px] sm:h-[62px]"
              }`}
              style={{
                maxWidth: 280,
                objectFit: "contain",
                filter: isScrolled ? "none" : "drop-shadow(0 2px 8px rgba(0,0,0,0.45))",
              }}
              onError={(event) => {
                event.currentTarget.style.display = "none"
                const fallback = document.getElementById("logo-fallback")
                if (fallback) fallback.style.display = "flex"
              }}
            />
            <div
              id="logo-fallback"
              style={{ display: "none", flexDirection: "column" }}
              className="port-syne"
            >
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", color: "var(--port-ink)", lineHeight: 1 }}>
                HAGERSTONE
              </span>
              <span style={{ fontSize: 8, letterSpacing: "0.32em", color: "var(--port-muted)", marginTop: 3 }}>
                INTERNATIONAL
              </span>
            </div>
          </div>
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => handleLinkClick(event, link.href)}
              className="relative px-4 py-2 text-[13px] font-medium tracking-[0.04em] no-underline transition-colors duration-200 group"
              style={{
                color: isScrolled ? "var(--port-secondary)" : "rgba(255,255,255,0.82)",
                textShadow: isScrolled ? "none" : "0 2px 10px rgba(0,0,0,0.55)",
              }}
            >
              {link.label}
              <span
                className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full transition-all duration-300 group-hover:w-6"
                style={{ background: isScrolled ? "var(--port-accent)" : "#E8D5A8" }}
              />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            onClick={(event) => handleLinkClick(event, "#contact")}
            className="hidden md:inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] no-underline transition-all duration-250 hover:-translate-y-0.5"
            style={{
              borderColor: isScrolled ? "var(--port-border-hover)" : "rgba(232,213,168,0.55)",
              background: isScrolled ? "var(--port-surface)" : "rgba(255,255,255,0.08)",
              color: isScrolled ? "var(--port-ink)" : "#fff",
              backdropFilter: isScrolled ? "none" : "blur(16px)",
              WebkitBackdropFilter: isScrolled ? "none" : "blur(16px)",
              textShadow: isScrolled ? "none" : "0 1px 8px rgba(0,0,0,0.45)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--port-accent)]"
              style={{ animation: "port-pulse-soft 2s ease-in-out infinite" }}
            />
            Get in Touch
          </a>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="lg:hidden flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full border"
            style={{
              borderColor: isScrolled ? "var(--port-border)" : "rgba(232,213,168,0.45)",
              background: isScrolled ? "var(--port-surface)" : "rgba(255,255,255,0.08)",
              backdropFilter: isScrolled ? "none" : "blur(16px)",
            }}
          >
            <span
              className="block h-[1.5px] w-4 rounded-full transition-transform duration-300"
              style={{
                background: isScrolled ? "var(--port-ink)" : "#fff",
                transform: isMobileOpen ? "translateY(3.5px) rotate(45deg)" : "none",
              }}
            />
            <span
              className="block h-[1.5px] w-4 rounded-full transition-transform duration-300"
              style={{
                background: isScrolled ? "var(--port-ink)" : "#fff",
                transform: isMobileOpen ? "translateY(-3.5px) rotate(-45deg)" : "none",
              }}
            />
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ height: isMobileOpen ? "auto" : 0, opacity: isMobileOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden lg:hidden"
        style={{ borderTop: isMobileOpen ? "1px solid var(--port-border)" : "none" }}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {NAV_LINKS.map((link, index) => (
            <motion.a
              key={link.href}
              href={link.href}
              onClick={(event) => handleLinkClick(event, link.href)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isMobileOpen ? 1 : 0, x: isMobileOpen ? 0 : -10 }}
              transition={{ duration: 0.3, delay: isMobileOpen ? index * 0.05 : 0 }}
              className="rounded-xl px-4 py-3 text-[14px] font-medium text-[var(--port-secondary)] no-underline transition-colors hover:bg-[var(--port-accent-soft)] hover:text-[var(--port-ink)]"
            >
              {link.label}
            </motion.a>
          ))}
          <a
            href="#contact"
            onClick={(event) => handleLinkClick(event, "#contact")}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--port-ink)] px-5 py-3 text-[14px] font-semibold text-[var(--port-bg)] no-underline"
          >
            Get in Touch →
          </a>
        </div>
      </motion.div>
    </motion.nav>
  )
}
