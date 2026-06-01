"use client"

/* eslint-disable @next/next/no-img-element */

import { motion, useInView, type Variants } from "framer-motion"
import { useRef } from "react"

import { SECTORS, TESTIMONIALS } from "@/lib/portfolio-data"
import { portfolioImage } from "@/lib/utils/portfolio-media"

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export function TestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      id="testimonials"
      className="port-section relative overflow-hidden px-6 md:px-12 lg:px-[8vw]"
      style={{
        background:
          "linear-gradient(180deg, #FCFAF5 0%, var(--port-bg) 100%)",
        borderTop: "1px solid var(--port-border-soft)",
        borderBottom: "1px solid var(--port-border-soft)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, var(--port-accent-warm), transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="relative mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between"
      >
        <div className="max-w-2xl">
          <div className="port-eyebrow mb-5">Client Voices</div>
          <h2 className="font-syne text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--port-ink)] md:text-[52px]">
            What clients{" "}
            <span className="port-serif italic font-medium text-[var(--port-accent-deep)]">say</span>{" "}
            about us
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--port-border)] bg-[var(--port-surface)] px-5 py-4 shadow-sm">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg key={star} width="18" height="18" viewBox="0 0 24 24" fill="var(--port-accent)">
                <path d="M12 2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 15.3 6.8 18l1-5.8L3.6 8.1l5.8-.8L12 2z" />
              </svg>
            ))}
          </div>
          <div>
            <div className="font-syne text-[18px] font-bold leading-none text-[var(--port-ink)]">4.9 / 5.0</div>
            <div className="mt-1 text-[11px] tracking-[0.1em] text-[var(--port-muted)]">FROM 200+ CLIENTS</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate={isInView ? "show" : "hidden"}
        className="relative grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        {TESTIMONIALS.map((testimonial, index) => {
          const accentColor =
            SECTORS.find((sector) => sector.id === testimonial.sectorId)?.accentColor ?? "var(--port-accent)"

          return (
            <motion.article
              key={testimonial.name}
              variants={item}
              whileHover={{ y: -6, transition: { duration: 0.3, ease: EASE } }}
              className="group relative flex flex-col overflow-hidden rounded-[20px] border bg-[var(--port-card)] p-8 transition-all duration-500"
              style={{
                borderColor: "var(--port-border)",
                boxShadow: "var(--port-shadow-sm)",
                minHeight: 320,
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = "var(--port-border-hover)"
                event.currentTarget.style.boxShadow = "var(--port-shadow-lg)"
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = "var(--port-border)"
                event.currentTarget.style.boxShadow = "var(--port-shadow-sm)"
              }}
            >
              <div
                className="pointer-events-none absolute -right-4 -top-2 font-syne text-[140px] font-extrabold leading-none opacity-[0.06] transition-all duration-500 group-hover:opacity-[0.12] group-hover:scale-110"
                style={{ color: "var(--port-accent-deep)" }}
              >
                &ldquo;
              </div>

              <div className="mb-6 flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill="var(--port-accent)">
                      <path d="M12 2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 15.3 6.8 18l1-5.8L3.6 8.1l5.8-.8L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[10px] tracking-[0.18em] text-[var(--port-muted)]">
                  0{index + 1} / 0{TESTIMONIALS.length}
                </span>
              </div>

              <p className="relative z-[1] flex-1 text-[15px] leading-[1.75] text-[var(--port-secondary)]">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              <div className="relative mt-7 flex items-center gap-4 border-t border-[var(--port-border-soft)] pt-6">
                {testimonial.logo ? (
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[var(--port-surface)] p-2"
                    style={{
                      borderColor: "var(--port-border)",
                      boxShadow: "0 2px 8px rgba(26,22,18,0.06)",
                    }}
                  >
                    <img
                      src={portfolioImage(testimonial.logo, { width: 200, quality: 85 })}
                      alt={`${testimonial.company} logo`}
                      loading="lazy"
                      style={{
                        maxHeight: "100%",
                        maxWidth: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                        display: "block",
                      }}
                      onError={(event) => {
                        // If the logo file is missing, hide the box gracefully
                        // and let the text-only client name carry the card.
                        const wrapper = event.currentTarget.parentElement
                        if (wrapper) wrapper.style.display = "none"
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl font-syne text-[18px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}, var(--port-accent-deep))`,
                      boxShadow: "0 4px 12px rgba(126,93,41,0.20)",
                    }}
                  >
                    {testimonial.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-syne text-[15px] font-bold uppercase tracking-[0.06em] text-[var(--port-ink)]">
                    {testimonial.company}
                  </div>
                  <div className="mt-1 text-[12px] leading-[1.5] text-[var(--port-muted)]">
                    {testimonial.designation}
                  </div>
                </div>
              </div>
            </motion.article>
          )
        })}
      </motion.div>
    </section>
  )
}
