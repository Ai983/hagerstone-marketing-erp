"use client"

/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion"

import { portfolioImage } from "@/lib/utils/portfolio-media"

const CLIENT_LOGOS = [
  { name: "AECOM", src: "/portfolio/clients/AECOM.png" },
  { name: "Andritz", src: "/portfolio/clients/Andritz.png" },
  { name: "APL", src: "/portfolio/clients/APL.png" },
  { name: "Consern Pharma", src: "/portfolio/clients/Consern%20Pharma.png" },
  { name: "DEE Piping", src: "/portfolio/clients/DEE%20Piping.png" },
  { name: "Hero Homes", src: "/portfolio/clients/HeroHomes.png" },
  { name: "Himalaya Construction", src: "/portfolio/clients/Himalaya%20Construction.png" },
  { name: "Inshorts", src: "/portfolio/clients/Inshorts.png" },
  { name: "Lufthansa", src: "/portfolio/clients/Lufthansa.png" },
  { name: "M3M", src: "/portfolio/clients/M3M_logo.png" },
  { name: "Max Healthcare", src: "/portfolio/clients/Max_Healthcare.png" },
  { name: "Microsave (MSC)", src: "/portfolio/clients/Microsave(MSC).png" },
  { name: "Minebea Mitsumi", src: "/portfolio/clients/MinebeaMitsumi.png" },
  { name: "Singapore Airlines", src: "/portfolio/clients/SingaporeAirlines.png" },
  { name: "Statkraft", src: "/portfolio/clients/Statkraft.png" },
  { name: "Taj", src: "/portfolio/clients/Taj.png" },
  { name: "Theon Lifesciences", src: "/portfolio/clients/Theon%20Lifesciences.png" },
  { name: "UltraTech", src: "/portfolio/clients/UltraTech.png" },
  { name: "Vinfast", src: "/portfolio/clients/Vinfast.png" },
  { name: "VST Core B", src: "/portfolio/clients/VSTcoreB.png" },
]

// Compact logo cell used inside the two mobile marquee rows.
function MobileLogoItem({ logo }: { logo: { name: string; src: string } }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 22px",
        borderRight: "1px solid rgba(201,168,76,0.06)",
        height: 64,
        flexShrink: 0,
      }}
    >
      <img
        src={portfolioImage(logo.src, { width: 280, quality: 80 })}
        alt={logo.name}
        loading="lazy"
        style={{
          height: 32,
          width: "auto",
          maxWidth: 110,
          objectFit: "contain",
          opacity: 0.7,
          transition: "opacity 200ms ease",
        }}
        onError={(event) => {
          const parent = event.currentTarget.parentElement
          if (!parent || parent.querySelector("[data-logo-fallback='true']")) return
          event.currentTarget.style.display = "none"
          const span = document.createElement("span")
          span.dataset.logoFallback = "true"
          span.textContent = logo.name.toUpperCase()
          span.style.cssText =
            "font-family:'DM Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.12em;color:#9A8E78;white-space:nowrap;"
          parent.appendChild(span)
        }}
      />
    </div>
  )
}

export function ClientLogos() {
  // Desktop track — same 3× duplication for the existing CSS keyframe animation.
  const desktopLogos = [...CLIENT_LOGOS, ...CLIENT_LOGOS, ...CLIENT_LOGOS]

  // Mobile rows — 2× duplication so framer-motion -50% translateX loops seamlessly.
  const row1Logos = [...CLIENT_LOGOS, ...CLIENT_LOGOS]
  const row2Logos = [
    ...[...CLIENT_LOGOS].reverse(),
    ...[...CLIENT_LOGOS].reverse(),
  ]

  return (
    <section
      className="logos-section"
      style={{
        background: "linear-gradient(180deg, #F5F1E8 0%, #EFEADB 100%)",
        borderBottom: "1px solid var(--port-border-soft)",
        padding: "80px 0 96px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 48,
          padding: "0 24px",
        }}
      >
        <div
          className="port-eyebrow"
          style={{
            display: "inline-flex",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          Our Clients
        </div>
        <h3
          className="font-syne"
          style={{
            fontSize: "clamp(24px, 3.2vw, 34px)",
            fontWeight: 700,
            color: "var(--port-ink)",
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
            maxWidth: 720,
            margin: "0 auto 12px",
          }}
        >
          Trusted by leading organisations across
          <span className="port-serif italic font-medium" style={{ color: "var(--port-accent-deep)" }}>
            {" "}India &amp; the world
          </span>
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "var(--port-secondary)",
            maxWidth: 560,
            margin: "0 auto",
            lineHeight: 1.65,
          }}
        >
          We partner with Fortune 500 firms, public sector organisations and industry leaders worldwide.
        </p>
      </div>

      <div style={{ position: "relative" }}>
        {/* Left + right fade masks — shared by desktop track and mobile rows */}
        <div
          className="logos-fade-left"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 160,
            background:
              "linear-gradient(90deg, #F2EDDF 0%, rgba(242,237,223,0.85) 50%, transparent 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
        <div
          className="logos-fade-right"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 160,
            background:
              "linear-gradient(270deg, #F2EDDF 0%, rgba(242,237,223,0.85) 50%, transparent 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Desktop single row — existing CSS keyframe animation */}
        <div
          className="logos-desktop-row logo-track"
          style={{
            display: "flex",
            gap: 24,
            width: "max-content",
            animation: "logoScroll 60s linear infinite",
            padding: "12px 0",
          }}
        >
          {desktopLogos.map((logo, index) => (
            <div
              key={`${logo.name}-${index}`}
              className="logo-card"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: 200,
                height: 110,
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #EAE4D2",
                boxShadow: "0 2px 8px rgba(26,22,18,0.04), 0 1px 2px rgba(26,22,18,0.03)",
                padding: "20px 24px",
                position: "relative",
              }}
            >
              <img
                src={portfolioImage(logo.src, { width: 400, quality: 80 })}
                alt={logo.name}
                loading="lazy"
                style={{
                  maxHeight: 60,
                  maxWidth: "100%",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
                onError={(event) => {
                  const parent = event.currentTarget.parentElement
                  if (!parent || parent.querySelector("[data-logo-fallback='true']")) return

                  event.currentTarget.style.display = "none"
                  const span = document.createElement("span")
                  span.dataset.logoFallback = "true"
                  span.textContent = logo.name.toUpperCase()
                  span.style.cssText = `
                    font-family: 'Syne', sans-serif;
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    color: var(--port-secondary);
                    text-align: center;
                    line-height: 1.3;
                  `
                  parent.appendChild(span)
                }}
              />
            </div>
          ))}
        </div>

        {/* Mobile two rows — opposite directions, faster pace */}
        <div
          className="logos-mobile-rows"
          style={{
            flexDirection: "column",
            gap: 12,
            display: "none",
          }}
        >
          {/* Row 1 — right to left */}
          <div style={{ overflow: "hidden", position: "relative" }}>
            <motion.div
              animate={{ translateX: "-50%" }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear",
                repeatType: "loop",
              }}
              style={{
                display: "flex",
                width: "max-content",
                gap: 0,
              }}
            >
              {row1Logos.map((logo, i) => (
                <MobileLogoItem key={`r1-${logo.name}-${i}`} logo={logo} />
              ))}
            </motion.div>
          </div>

          {/* Row 2 — left to right (animates -50% → 0%) */}
          <div style={{ overflow: "hidden", position: "relative" }}>
            <motion.div
              initial={{ translateX: "-50%" }}
              animate={{ translateX: "0%" }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear",
                repeatType: "loop",
              }}
              style={{
                display: "flex",
                width: "max-content",
                gap: 0,
              }}
            >
              {row2Logos.map((logo, i) => (
                <MobileLogoItem key={`r2-${logo.name}-${i}`} logo={logo} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes logoScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .logo-track:hover {
          animation-play-state: paused;
        }
        .logo-card {
          transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 350ms cubic-bezier(0.4, 0, 0.2, 1),
            border-color 350ms ease;
        }
        .logo-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 14px 32px rgba(26,22,18,0.10), 0 4px 10px rgba(26,22,18,0.05);
          border-color: var(--port-border-hover);
        }
        .logo-card img {
          transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .logo-card:hover img {
          transform: scale(1.05);
        }
      `}</style>
    </section>
  )
}
