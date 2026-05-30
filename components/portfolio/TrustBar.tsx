"use client"

import { useEffect, useRef } from "react"
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion"

import { TRUST_STATS } from "@/lib/portfolio-data"

function splitStatValue(value: string) {
  const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ""))
  const suffix = value.replace(/[\d.]/g, "")
  return { numeric, suffix }
}

type StatTileProps = {
  value: string
  label: string
  index: number
  isInView: boolean
}

function StatTile({ value, label, index, isInView }: StatTileProps) {
  const { numeric, suffix } = splitStatValue(value)
  const count = useMotionValue(0)
  const display = useTransform(count, (latest) =>
    `${Math.round(latest)}${suffix}`
  )

  const tileDelay = 0.15 + index * 0.12
  const countDelay = tileDelay + 0.25
  const countDuration = 2.2

  useEffect(() => {
    if (!isInView) return
    const controls = animate(count, numeric, {
      duration: countDuration,
      delay: countDelay,
      ease: [0.22, 1, 0.36, 1],
    })
    return () => controls.stop()
  }, [isInView, numeric, count, countDelay])

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.92, filter: "blur(6px)" }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, y: 40, scale: 0.92, filter: "blur(6px)" }
      }
      transition={{ duration: 0.75, delay: tileDelay, ease: [0.4, 0, 0.2, 1] }}
      className="relative"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <motion.div
        className="font-syne font-bold leading-[0.95] tracking-[-0.02em] text-[var(--port-ink)]"
        style={{
          fontSize: "clamp(48px, 6vw, 72px)",
          minWidth: "120px",
        }}
        initial={{ scale: 0.85 }}
        animate={
          isInView
            ? {
                scale: [0.85, 1.04, 1],
              }
            : { scale: 0.85 }
        }
        transition={{
          duration: countDuration + 0.6,
          delay: countDelay,
          times: [0, 0.92, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.span>{display}</motion.span>
      </motion.div>

      <motion.div
        className="mt-5 h-px w-14"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--port-accent), transparent)",
          transformOrigin: "center",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={
          isInView
            ? { scaleX: 1, opacity: 1 }
            : { scaleX: 0, opacity: 0 }
        }
        transition={{
          duration: 1.1,
          delay: countDelay + 0.1,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      <motion.div
        className="mt-4 text-[13px] font-medium tracking-[0.04em] text-[var(--port-secondary)]"
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{
          duration: 0.6,
          delay: countDelay + countDuration * 0.55,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {label}
      </motion.div>
    </motion.div>
  )
}

export function TrustBar() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      className="relative px-6 py-24 md:px-12 md:py-28 lg:px-[6vw]"
      style={{
        background: "linear-gradient(180deg, #FBF9F4 0%, #F5F1E8 100%)",
        textAlign: "center",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--port-border) 1px, transparent 1px)",
          backgroundSize: "140px 100%",
          maskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
        }}
      />

      <div
        className="relative"
        style={{
          maxWidth: "1180px",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div className="mb-16 md:mb-20" style={{ textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="port-eyebrow mb-5"
            style={{ display: "inline-flex" }}
          >
            By the Numbers
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="font-syne text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[var(--port-ink)] md:text-[44px] lg:text-[52px]"
            style={{ textAlign: "center", margin: "0 auto" }}
          >
            A decade of crafting
            <span className="port-serif italic font-medium text-[var(--port-accent-deep)]">
              {" "}
              remarkable{" "}
            </span>
            spaces
          </motion.h2>
        </div>

        <div
          className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 md:gap-x-8 lg:gap-x-12"
          style={{ marginLeft: "auto", marginRight: "auto" }}
        >
          {TRUST_STATS.map((stat, index) => (
            <StatTile
              key={stat.label}
              value={stat.value}
              label={stat.label}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="mt-20"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            textAlign: "center",
          }}
        >
          <span className="text-[11px] tracking-[0.2em] text-[var(--port-muted)]">
            CERTIFIED &amp; ACCREDITED
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px",
              marginLeft: "4px",
            }}
          >
            {["ISO 9001:2015", "GST Registered", "MSME Certified", "PAN India Operations"].map(
              (badge, idx) => (
                <motion.span
                  key={badge}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={
                    isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }
                  }
                  transition={{
                    duration: 0.4,
                    delay: 1.3 + idx * 0.08,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--port-border)] bg-[var(--port-surface)] px-3 py-1.5 text-[11px] font-medium tracking-[0.03em] text-[var(--port-secondary)] shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--port-accent)]" />
                  {badge}
                </motion.span>
              )
            )}
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}
