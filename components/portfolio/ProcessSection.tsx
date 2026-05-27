"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

import { PROCESS_STEPS } from "@/lib/portfolio-data"

export function ProcessSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      id="process"
      className="port-section relative overflow-hidden px-6 md:px-12 lg:px-[8vw]"
      style={{
        background:
          "linear-gradient(180deg, var(--port-surface) 0%, #FCFAF5 100%)",
        borderTop: "1px solid var(--port-border-soft)",
        borderBottom: "1px solid var(--port-border-soft)",
      }}
    >
      <div
        className="pointer-events-none absolute right-[5%] top-20 h-72 w-72 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, var(--port-accent-warm), transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="relative mx-auto mb-20 max-w-2xl text-center"
      >
        <div className="port-eyebrow mb-5" style={{ justifyContent: "center" }}>
          How We Work · Our Process
        </div>
        <h2 className="font-syne text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--port-ink)] md:text-[52px]">
          From concept to{" "}
          <span className="port-serif italic font-medium text-[var(--port-accent-deep)]">handover</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.7] text-[var(--port-secondary)]">
          A proven five-stage process — designed to keep you informed, in control, and confident at every step.
        </p>
      </motion.div>

      <div className="relative">
        <div
          className="absolute top-[42px] hidden lg:block"
          style={{
            left: "10%",
            right: "10%",
            height: 2,
            background:
              "linear-gradient(90deg, transparent, var(--port-accent-line) 15%, var(--port-accent-line) 85%, transparent)",
            zIndex: 0,
          }}
        />

        <motion.div
          className="absolute top-[42px] hidden lg:block"
          style={{
            left: "10%",
            height: 2,
            background:
              "linear-gradient(90deg, var(--port-accent), var(--port-accent-bright))",
            zIndex: 1,
            transformOrigin: "left",
          }}
          initial={{ width: "0%" }}
          animate={isInView ? { width: "80%" } : {}}
          transition={{ duration: 2, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {PROCESS_STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + index * 0.12, ease: [0.4, 0, 0.2, 1] }}
              className="group relative flex flex-col items-center text-center"
            >
              <motion.div
                className="relative mb-7 flex h-[88px] w-[88px] items-center justify-center"
                whileHover={{ scale: 1.06, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="absolute inset-0 rounded-full border bg-[var(--port-surface)] transition-all duration-500 group-hover:bg-[var(--port-accent-soft)]"
                  style={{
                    borderColor: "var(--port-border)",
                    boxShadow: "var(--port-shadow-md)",
                  }}
                />
                <div
                  className="absolute inset-1.5 rounded-full border border-dashed opacity-50"
                  style={{ borderColor: "var(--port-accent)" }}
                />
                <div className="relative flex flex-col items-center justify-center">
                  <span className="text-[9px] tracking-[0.2em] text-[var(--port-muted)]">STEP</span>
                  <span className="font-syne text-[24px] font-bold leading-none text-[var(--port-accent-deep)]">
                    {step.number}
                  </span>
                </div>

                <motion.div
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full"
                  style={{
                    background: "var(--port-accent)",
                    boxShadow: "0 0 12px var(--port-accent-glow)",
                  }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.4 }}
                />
              </motion.div>

              <h3 className="font-syne mb-3 text-[17px] font-bold leading-[1.3] text-[var(--port-ink)]">
                {step.title}
              </h3>
              <p className="px-2 text-[13px] leading-[1.65] text-[var(--port-secondary)]">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
