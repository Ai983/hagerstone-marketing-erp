"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { portfolioMedia } from "@/lib/utils/portfolio-media"

const NAV_LINKS = [
  { label: "Work", href: "#projects" },
  { label: "Process", href: "#process" },
  { label: "Why Us", href: "#whyus" },
  { label: "Testimonials", href: "#testimonials" },
]

const MOBILE_LINKS = [
  { label: "Our Work", href: "#projects" },
  { label: "Our Process", href: "#process" },
  { label: "Why Us", href: "#whyus" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Get in Touch", href: "#contact" },
]

export function PortfolioNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
      setMenuOpen(false)
    }
  }

  // Mobile menu links: close the panel first, then scroll after the slide-up
  // animation has finished — feels more polished than scrolling mid-collapse.
  const handleMobileLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.preventDefault()
    setMenuOpen(false)
    if (href.startsWith("#")) {
      window.setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 300)
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
        className="port-nav-inner flex items-center justify-between px-6 md:px-12 lg:px-[8vw]"
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
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="port-hamburger"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: isScrolled
                ? "rgba(28,22,16,0.08)"
                : "rgba(255,255,255,0.1)",
              border: isScrolled
                ? "1px solid rgba(28,22,16,0.15)"
                : "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isScrolled ? "var(--port-ink)" : "#ffffff",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              cursor: "pointer",
              padding: 0,
              transition: "background 200ms, border-color 200ms, color 200ms",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? "close" : "open"}
                initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: menuOpen ? 16 : 18,
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                {menuOpen ? "✕" : "☰"}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop — closes the menu on outside click. Transparent so
                the hero behind the panel stays fully visible. */}
            <motion.div
              key="port-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 998,
                background: "transparent",
              }}
            />

            {/* Slide-down translucent panel */}
            <motion.div
              key="port-nav-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "absolute",
                top: 68,
                left: 0,
                right: 0,
                width: "100%",
                background:
                  "linear-gradient(180deg, rgba(28,22,16,0.55) 0%, rgba(28,22,16,0.45) 100%)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(201,168,76,0.18)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 40px -12px rgba(0,0,0,0.35)",
                zIndex: 999,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "24px 28px 28px" }}>
                {/* Nav links — vertical list with bottom borders */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {MOBILE_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(event) => handleMobileLinkClick(event, link.href)}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15,
                        fontWeight: 400,
                        color: "rgba(245,240,232,0.85)",
                        letterSpacing: "0.04em",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textDecoration: "none",
                        transition: "color 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ffffff"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(245,240,232,0.85)"
                      }}
                    >
                      <span>{link.label}</span>
                      <span style={{ color: "rgba(245,240,232,0.4)", fontSize: 14 }}>
                        →
                      </span>
                    </a>
                  ))}
                </div>

                {/* Instagram handle row */}
                <a
                  href="https://www.instagram.com/hagerstone_international/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 20,
                    fontSize: 11,
                    color: "rgba(245,240,232,0.5)",
                    letterSpacing: "0.04em",
                    textDecoration: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  <span>@hagerstone_international</span>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
