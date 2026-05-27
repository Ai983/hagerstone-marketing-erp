"use client"

import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

import { SECTORS, type Sector } from "@/lib/portfolio-data"

export function SectorTabs({
  activeSector,
  onSelect,
}: {
  activeSector: Sector
  onSelect: (id: string) => void
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = SECTORS.findIndex((sector) => sector.id === activeSector.id)
      const element = tabRefs.current[activeIndex]
      if (element) {
        setPillStyle({
          left: element.offsetLeft,
          width: element.offsetWidth,
        })
        setIsReady(true)
      }
    }

    updateIndicator()
    const timer = window.setTimeout(updateIndicator, 100)
    window.addEventListener("resize", updateIndicator)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("resize", updateIndicator)
    }
  }, [activeSector.id])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100)
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const activeIndex = SECTORS.findIndex((sector) => sector.id === activeSector.id)

  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 100,
        background: isScrolled ? "rgba(251,249,244,0.95)" : "rgba(251,249,244,0.88)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "1px solid var(--port-border-soft)",
        boxShadow: isScrolled ? "0 4px 20px rgba(26,22,18,0.04)" : "none",
        transition: "all 300ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 lg:px-[6vw]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--port-border-soft)] py-3">
          <div className="flex items-center gap-2.5 text-[11px] tracking-[0.2em] text-[var(--port-muted)]">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-[var(--port-accent)] opacity-75"
                style={{ animation: "port-pulse-soft 2s ease-in-out infinite" }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--port-accent)]" />
            </span>
            <span className="hidden sm:inline">EXPLORE BY SECTOR</span>
            <span className="sm:hidden">SECTORS</span>
            <span className="hidden md:inline text-[var(--port-muted-soft)]">
              · {String(activeIndex + 1).padStart(2, "0")} / {String(SECTORS.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div
          className="sector-tabs-inner overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`.sector-tabs-inner::-webkit-scrollbar { display: none; }`}</style>

          <div
            className="relative flex items-center justify-start py-3 md:justify-center"
            style={{ minWidth: "max-content" }}
          >
            <div className="relative flex items-center gap-1">
              <motion.div
                animate={{ left: pillStyle.left, width: pillStyle.width }}
                initial={false}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 42,
                  background:
                    "linear-gradient(135deg, #1A1612 0%, #2B2620 100%)",
                  borderRadius: 999,
                  zIndex: 0,
                  boxShadow:
                    "0 6px 18px rgba(26,22,18,0.25), inset 0 1px 0 rgba(232,213,168,0.12)",
                  opacity: isReady ? 1 : 0,
                  pointerEvents: "none",
                }}
              />

              {SECTORS.map((sector, index) => {
                const isActive = sector.id === activeSector.id

                return (
                  <button
                    key={sector.id}
                    ref={(element) => {
                      tabRefs.current[index] = element
                    }}
                    type="button"
                    onClick={() => onSelect(sector.id)}
                    style={{
                      position: "relative",
                      padding: "11px 22px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: "0.02em",
                      color: isActive ? "#FBF9F4" : "var(--port-secondary)",
                      whiteSpace: "nowrap",
                      transition: "color 300ms ease",
                      outline: "none",
                      zIndex: 1,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(event) => {
                      if (!isActive) event.currentTarget.style.color = "var(--port-ink)"
                    }}
                    onMouseLeave={(event) => {
                      if (!isActive) event.currentTarget.style.color = "var(--port-secondary)"
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full transition-all duration-300"
                      style={{
                        background: isActive
                          ? sector.accentColor
                          : "var(--port-border-hover)",
                        boxShadow: isActive
                          ? `0 0 8px ${sector.accentColor}`
                          : "none",
                      }}
                    />
                    {sector.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
