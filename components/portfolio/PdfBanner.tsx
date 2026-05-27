"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

import type { Sector } from "@/lib/portfolio-data"
import { portfolioMedia } from "@/lib/utils/portfolio-media"

export function PdfBanner({ sector }: { sector: Sector }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  const portfolioPdfUrl = portfolioMedia(sector.portfolioPdf)

  return (
    <div className="bg-[var(--port-bg)] px-6 pb-24 pt-4 md:px-12 lg:px-[8vw]">
      <div ref={ref} className="relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-[28px] border border-[var(--port-border)]"
          style={{
            background:
              "linear-gradient(135deg, #FFFFFF 0%, #FCFAF5 50%, #F5EFE0 100%)",
            boxShadow: "var(--port-shadow-lg)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-[400px] w-[400px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(201,168,118,0.18), transparent 65%)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-32 -bottom-32 h-[320px] w-[320px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(232,213,168,0.25), transparent 65%)",
              filter: "blur(40px)",
            }}
          />

          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--port-accent), transparent)",
            }}
          />

          <div className="relative flex flex-col items-start gap-10 px-8 py-12 md:flex-row md:items-center md:px-14 md:py-14">
            <div className="flex flex-1 items-start gap-6 md:items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="relative flex-shrink-0"
              >
                <div
                  className="absolute inset-0 -rotate-6 rounded-[14px] border border-[var(--port-border)] bg-[var(--port-surface)]"
                  style={{ boxShadow: "var(--port-shadow-sm)" }}
                />
                <div
                  className="absolute inset-0 rotate-3 rounded-[14px] border border-[var(--port-border)] bg-[var(--port-bg-soft)]"
                  style={{ boxShadow: "var(--port-shadow-sm)" }}
                />
                <div
                  className="relative flex h-20 w-16 items-center justify-center rounded-[14px] border border-[var(--port-accent-line)] bg-gradient-to-br from-[var(--port-accent-warm)] to-[var(--port-accent-bright)]"
                  style={{ boxShadow: "0 8px 24px rgba(201,168,118,0.35)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#FBF9F4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2v6h6" stroke="#FBF9F4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 13h6M9 17h6M9 9h2" stroke="#FBF9F4" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
              </motion.div>

              <div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="port-eyebrow mb-4"
                >
                  Company Portfolio · PDF
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="font-syne text-[24px] font-bold leading-[1.2] text-[var(--port-ink)] md:text-[28px]"
                >
                  {sector.pdfLabel}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--port-muted)]"
                >
                  {["Case Studies", "Specifications", "Client References"].map((label) => (
                    <span key={label} className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="var(--port-accent-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {label}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.55, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-shrink-0 flex-wrap gap-3"
            >
              <a
                href={portfolioPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="port-btn-primary group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                </svg>
                View Portfolio
              </a>
              <a
                href={portfolioPdfUrl}
                download
                className="port-btn-secondary group"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download PDF
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
