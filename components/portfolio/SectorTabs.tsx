"use client"

import { motion, AnimatePresence } from "framer-motion"
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
  const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverStyle, setHoverStyle] = useState({ left: 0, width: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = SECTORS.findIndex((s) => s.id === activeSector.id)
      const el = tabRefs.current[activeIndex]
      if (el) {
        setPillStyle({ left: el.offsetLeft, width: el.offsetWidth })
        setLineStyle({ left: el.offsetLeft + 16, width: el.offsetWidth - 32 })
        setIsReady(true)
      }
    }
    updateIndicator()
    const timer = window.setTimeout(updateIndicator, 100)
    window.addEventListener("resize", updateIndicator)
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", updateIndicator) }
  }, [activeSector.id])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100)
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleHoverStart = (id: string, index: number) => {
    const el = tabRefs.current[index]
    if (el) setHoverStyle({ left: el.offsetLeft, width: el.offsetWidth })
    setHoveredId(id)
  }

  const activeIndex = SECTORS.findIndex((s) => s.id === activeSector.id)

  const spring = { type: "spring" as const, stiffness: 420, damping: 36 }

  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 100,
        background: isScrolled ? "rgba(251,249,244,0.97)" : "rgba(251,249,244,0.90)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderBottom: "1px solid var(--port-border-soft)",
        boxShadow: isScrolled ? "0 4px 24px rgba(26,22,18,0.06)" : "none",
        transition: "background 300ms ease, box-shadow 300ms ease",
      }}
    >
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 lg:px-[6vw]">
        {/* Top label row */}
        <div className="flex items-center gap-2.5 border-b border-[var(--port-border-soft)] py-2.5 text-[10px] tracking-[0.22em] text-[var(--port-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[var(--port-accent)] opacity-75"
              style={{ animation: "port-pulse-soft 2s ease-in-out infinite" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--port-accent)]" />
          </span>
          <span className="hidden sm:inline">EXPLORE BY SECTOR</span>
          <span className="sm:hidden">SECTORS</span>
          <span className="hidden md:inline opacity-50">
            · {String(activeIndex + 1).padStart(2, "0")} / {String(SECTORS.length).padStart(2, "0")}
          </span>
        </div>

        {/* Tab row */}
        <div className="w-full overflow-hidden">
          <div
            className="relative flex items-center justify-center py-2.5"
          >
            <div className="relative flex items-center gap-0">

              {/* Hover ghost pill */}
              <AnimatePresence>
                {hoveredId && hoveredId !== activeSector.id && (
                  <motion.div
                    key="hover-pill"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1, left: hoverStyle.left, width: hoverStyle.width }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ ...spring, opacity: { duration: 0.15 } }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      height: 40,
                      background: "rgba(26,22,18,0.07)",
                      borderRadius: 999,
                      pointerEvents: "none",
                      zIndex: 0,
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Active pill */}
              <motion.div
                animate={{ left: pillStyle.left, width: pillStyle.width }}
                initial={false}
                transition={spring}
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 42,
                  background: "linear-gradient(135deg, #1A1612 0%, #2B2620 100%)",
                  borderRadius: 999,
                  zIndex: 1,
                  boxShadow: "0 6px 20px rgba(26,22,18,0.28), inset 0 1px 0 rgba(232,213,168,0.14)",
                  opacity: isReady ? 1 : 0,
                  pointerEvents: "none",
                }}
              />

              {/* Bottom accent line under active tab */}
              <motion.div
                animate={{ left: lineStyle.left, width: lineStyle.width }}
                initial={false}
                transition={spring}
                style={{
                  position: "absolute",
                  bottom: -10,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${activeSector.accentColor}, transparent)`,
                  borderRadius: 999,
                  zIndex: 2,
                  opacity: isReady ? 1 : 0,
                  pointerEvents: "none",
                  boxShadow: `0 0 8px ${activeSector.accentColor}88`,
                  transition: "background 400ms ease, box-shadow 400ms ease",
                }}
              />

              {SECTORS.map((sector, index) => {
                const isActive = sector.id === activeSector.id
                return (
                  <motion.button
                    key={sector.id}
                    ref={(el) => { tabRefs.current[index] = el }}
                    type="button"
                    onClick={() => onSelect(sector.id)}
                    onHoverStart={() => handleHoverStart(sector.id, index)}
                    onHoverEnd={() => setHoveredId(null)}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{
                      position: "relative",
                      padding: "11px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: "0.02em",
                      color: isActive ? "#FBF9F4" : "var(--port-secondary)",
                      whiteSpace: "nowrap",
                      outline: "none",
                      zIndex: 2,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                    animate={{
                      color: isActive ? "#FBF9F4" : hoveredId === sector.id ? "var(--port-ink)" : "var(--port-secondary)",
                    }}
                  >
                    {/* Accent dot */}
                    <motion.span
                      animate={{
                        scale: isActive ? 1.2 : 1,
                        background: isActive ? sector.accentColor : hoveredId === sector.id ? "var(--port-ink)" : "var(--port-border-hover)",
                        boxShadow: isActive ? `0 0 8px ${sector.accentColor}` : "none",
                      }}
                      transition={{ duration: 0.25 }}
                      style={{
                        display: "inline-block",
                        height: 6,
                        width: 6,
                        flexShrink: 0,
                        borderRadius: 999,
                      }}
                    />
                    {sector.label}
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
