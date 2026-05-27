"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const FEATURES = [
  "11+ Years of Office Design & Build Excellence",
  "500+ Satisfied Corporate Clients",
  "Fortune 500 Workspace Experience",
  "End-to-End Turnkey Solutions",
]

export function WhyUs() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      id="why"
      ref={ref}
      className="port-section relative overflow-hidden px-6 md:px-10 lg:px-[3vw]"
      style={{
        background:
          "linear-gradient(180deg, var(--port-bg) 0%, var(--port-bg-soft) 100%)",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-20 h-[420px] w-[420px] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, var(--port-accent-warm), transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-[480px] w-[480px] rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(circle, rgba(201,168,118,0.30), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div
        className="relative"
        style={{
          maxWidth: "1600px",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-[32px] border"
          style={{
            background:
              "linear-gradient(145deg, #FFFFFF 0%, #FCFAF5 55%, #F5EFE0 100%)",
            borderColor: "var(--port-border)",
            boxShadow: "var(--port-shadow-xl)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="port-gold-shimmer-ltr"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "70%",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(201,168,118,0.32) 50%, transparent 100%)",
                filter: "blur(40px)",
              }}
            />
            <div
              className="port-gold-shimmer-rtl"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "55%",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(232,213,168,0.28) 50%, transparent 100%)",
                filter: "blur(50px)",
              }}
            />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(201,168,118,0.25), transparent 65%)",
              filter: "blur(60px)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 -bottom-32 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(232,213,168,0.30), transparent 65%)",
              filter: "blur(60px)",
            }}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-12 right-12 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--port-accent), transparent)",
            }}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(165,127,63,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage:
                "radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent 85%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent 85%)",
            }}
          />

          <div
            className="relative px-8 py-16 md:px-16 md:py-20 lg:px-24 lg:py-24 xl:px-32"
            style={{ textAlign: "center" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              <h2
                className="font-syne text-[30px] font-bold leading-[1.15] tracking-[-0.01em] text-[var(--port-ink)] md:text-[40px] lg:text-[48px]"
                style={{
                  maxWidth: "1100px",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                Why Choose Hagerstone as Your{" "}
                <span className="port-serif italic font-medium text-[var(--port-accent-deep)]">
                  Office Design &amp; Build Partner?
                </span>
              </h2>

              <p
                className="mt-5 text-[16px] font-medium leading-[1.5] text-[var(--port-accent-deep)] md:text-[18px]"
                style={{
                  maxWidth: "720px",
                  margin: "20px auto 0",
                  textAlign: "center",
                }}
              >
                Excellence in every office project, innovation in every design.
              </p>

              <p
                className="mt-6 text-[14px] leading-[1.75] text-[var(--port-secondary)] md:text-[15px]"
                style={{
                  maxWidth: "900px",
                  margin: "24px auto 0",
                  textAlign: "center",
                }}
              >
                From{" "}
                <span className="font-semibold text-[var(--port-accent-deep)]">
                  our experienced team
                </span>{" "}
                to Fortune 500 clients, discover what makes us the{" "}
                <span className="font-semibold text-[var(--port-accent-deep)]">
                  best interior designer
                </span>{" "}
                and{" "}
                <span className="font-semibold text-[var(--port-accent-deep)]">
                  office design &amp; build company
                </span>{" "}
                for your workspace.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="mt-20 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
            >
              {FEATURES.map((feature, idx) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, y: 28, scale: 0.92 }}
                  animate={
                    isInView
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 0, y: 28, scale: 0.92 }
                  }
                  transition={{
                    duration: 0.6,
                    delay: 0.4 + idx * 0.12,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  whileHover={{ y: -4 }}
                  className="group flex flex-col items-center text-center"
                >
                  <div
                    className="relative mb-7 flex h-[88px] w-[88px] items-center justify-center rounded-full transition-all duration-500 group-hover:scale-110"
                    style={{
                      border: "2px solid var(--port-accent)",
                      background:
                        "radial-gradient(circle, rgba(201,168,118,0.10) 0%, transparent 70%)",
                      boxShadow:
                        "0 0 0 6px rgba(201,168,118,0.08), inset 0 0 18px rgba(201,168,118,0.10)",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(232,213,168,0.40) 0%, transparent 70%)",
                      }}
                    />
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="relative z-[1]"
                    >
                      <path
                        d="M4 12.5l5 5L20 6.5"
                        stroke="var(--port-accent-deep)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <p
                    className="font-syne text-[16px] font-semibold leading-[1.4] text-[var(--port-ink)] md:text-[17px]"
                    style={{ maxWidth: "240px" }}
                  >
                    {feature}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
