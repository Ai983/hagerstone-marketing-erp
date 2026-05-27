"use client"

/* eslint-disable @next/next/no-img-element */

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

import { portfolioMedia } from "@/lib/utils/portfolio-media"

export function PortfolioLoader() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "linear-gradient(135deg, #FBF9F4 0%, #F5F1E8 100%)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "20%",
              left: "15%",
              width: 280,
              height: 280,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(232,213,168,0.4), transparent 70%)",
              filter: "blur(60px)",
              animation: "port-pulse-soft 4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "20%",
              right: "15%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(201,168,118,0.35), transparent 70%)",
              filter: "blur(80px)",
              animation: "port-pulse-soft 5s ease-in-out infinite reverse",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            style={{ textAlign: "center", position: "relative", zIndex: 1 }}
          >
            <img
              src={portfolioMedia("/portfolio/hagerstone-logo.png")}
              alt="Hagerstone International"
              style={{
                height: 160,
                width: "auto",
                maxWidth: 560,
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
              onError={(event) => {
                event.currentTarget.style.display = "none"
                const fallback = document.getElementById("loader-logo-fallback")
                if (fallback) fallback.style.display = "block"
              }}
            />
            <div id="loader-logo-fallback" style={{ display: "none" }}>
              <div
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  color: "var(--port-ink)",
                  lineHeight: 1,
                }}
              >
                HAGERSTONE
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.32em",
                  color: "var(--port-accent-deep)",
                  marginTop: 6,
                  fontWeight: 500,
                }}
              >
                INTERNATIONAL
              </div>
            </div>
          </motion.div>

          <div
            style={{
              width: 200,
              height: 2,
              background: "rgba(165,127,63,0.12)",
              borderRadius: 1,
              overflow: "hidden",
              position: "relative",
              zIndex: 1,
            }}
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
              style={{
                height: "100%",
                background:
                  "linear-gradient(90deg, var(--port-accent), var(--port-accent-bright))",
                borderRadius: 1,
                boxShadow: "0 0 12px rgba(201,168,118,0.4)",
              }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "var(--port-accent-deep)",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              position: "relative",
              zIndex: 1,
            }}
          >
            DESIGN · BUILD · DELIVER
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
