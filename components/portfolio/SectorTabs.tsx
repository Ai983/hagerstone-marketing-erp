"use client"

import { SECTORS, type Sector } from "@/lib/portfolio-data"

export function SectorTabs({
  activeSector,
  onSelect,
}: {
  activeSector: Sector
  onSelect: (id: string) => void
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 100,
        background: "rgba(251,249,244,0.95)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderBottom: "1px solid var(--port-border-soft)",
      }}
    >
      <div className="port-tabs-inner mx-auto max-w-[1400px] px-4 md:px-8 lg:px-[6vw]">
        {/* Top label row */}
        <div className="flex items-center gap-2.5 border-b border-[var(--port-border-soft)] py-2.5 text-[10px] tracking-[0.22em] text-[var(--port-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[var(--port-accent)] opacity-75"
              style={{ animation: "port-pulse-soft 2s ease-in-out infinite" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--port-accent)]" />
          </span>
          <span>SECTORS</span>
        </div>

        {/* Sector buttons.
            Mobile: 3-column grid → 8 sectors lay out as 3 + 3 + 2 = exactly 3 rows.
            Desktop (md+): flex-wrap centered so the full labels read naturally. */}
        <div
          className="grid grid-cols-3 gap-2 py-3 md:flex md:flex-wrap md:justify-center md:gap-2 md:py-3.5"
        >
          {SECTORS.map((sector) => {
            const isActive = sector.id === activeSector.id
            return (
              <button
                key={sector.id}
                type="button"
                onClick={() => onSelect(sector.id)}
                className="w-full whitespace-normal rounded-2xl md:w-auto md:whitespace-nowrap md:rounded-full"
                style={{
                  padding: "8px 16px",
                  border: isActive
                    ? "1px solid transparent"
                    : "1px solid var(--port-border)",
                  background: isActive
                    ? "linear-gradient(135deg, #1A1612 0%, #2B2620 100%)"
                    : "transparent",
                  color: isActive ? "#FBF9F4" : "var(--port-secondary)",
                  fontSize: 13,
                  lineHeight: 1.25,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  minWidth: 0,
                  textAlign: "center",
                  boxShadow: isActive
                    ? "0 6px 20px rgba(26,22,18,0.28), inset 0 1px 0 rgba(232,213,168,0.14)"
                    : "none",
                  transition:
                    "background 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--port-border-hover)"
                    e.currentTarget.style.color = "var(--port-ink)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--port-border)"
                    e.currentTarget.style.color = "var(--port-secondary)"
                  }
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isActive
                      ? sector.accentColor
                      : "rgba(184,134,11,0.4)",
                    display: "inline-block",
                    flexShrink: 0,
                    boxShadow: isActive
                      ? `0 0 8px ${sector.accentColor}`
                      : "none",
                  }}
                />
                <span>{sector.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
