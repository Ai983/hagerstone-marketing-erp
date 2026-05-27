"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

type ContactMethod = {
  label: string
  value: string
  href: string | null
  iconPath: string
  secondaryPath?: string
  helper?: string
}

type SocialLink = {
  label: string
  handle: string
  href: string
  brandBg: string
  iconPath: string
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    label: "Instagram",
    handle: "@hagerstone_international",
    href: "https://www.instagram.com/hagerstone_international/",
    brandBg: "linear-gradient(135deg, #FFD340 0%, #E1306C 50%, #C13584 100%)",
    iconPath:
      "M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4zM17.5 6.5h.01M3 12c0-3.2.1-3.7.2-5 .2-1.3.5-2.2 1.2-3 .7-.7 1.5-1 2.8-1.2 1.2-.1 1.7-.2 5-.2s3.7.1 5 .2c1.3.2 2.2.5 2.9 1.2.7.7 1 1.5 1.2 2.9.1 1.2.2 1.7.2 5 0 3.2-.1 3.7-.2 5-.2 1.3-.5 2.2-1.2 2.9-.7.7-1.5 1-2.9 1.2-1.2.1-1.7.2-5 .2s-3.7 0-5-.2c-1.3-.2-2.2-.5-2.9-1.2-.7-.7-1-1.5-1.2-2.9C3.1 15.7 3 15.2 3 12z",
  },
  {
    label: "Facebook",
    handle: "HagerstoneInternational",
    href: "https://www.facebook.com/HagerstoneInternational/",
    brandBg: "#1877F2",
    iconPath:
      "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  },
  {
    label: "LinkedIn",
    handle: "Hagerstone International",
    href: "https://www.linkedin.com/company/14708271/",
    brandBg: "#0A66C2",
    iconPath:
      "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  },
]

const CONTACT_METHODS: ContactMethod[] = [
  {
    label: "CALL US",
    value: "+91 99808 13555",
    href: "tel:+919980813555",
    iconPath:
      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  },
  {
    label: "EMAIL US",
    value: "sales@hagerstone.com",
    href: "mailto:sales@hagerstone.com",
    iconPath:
      "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  },
  {
    label: "VISIT US",
    value: "Noida · Delhi NCR",
    helper: "Operations across India",
    href: null,
    iconPath: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    secondaryPath: "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  },
]

export function PortfolioCTA() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="port-section relative overflow-hidden px-6 md:px-12 lg:px-[8vw]"
      style={{
        background:
          "linear-gradient(135deg, #161310 0%, #1E1814 50%, #241D15 100%)",
        textAlign: "center",
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
              "linear-gradient(90deg, transparent 0%, rgba(232,213,168,0.22) 50%, transparent 100%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(201,168,118,0.20), transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-[480px] w-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(232,213,168,0.16), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(232,213,168,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent 85%)",
        }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{
          maxWidth: "1280px",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(232,213,168,0.30)] bg-[rgba(232,213,168,0.08)] px-4 py-1.5 text-[11px] font-medium tracking-[0.18em] text-[#E8D5A8] backdrop-blur-sm"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#E8D5A8]"
            style={{ animation: "port-pulse-soft 2s ease-in-out infinite" }}
          />
          LET&apos;S BUILD TOGETHER
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="font-syne text-[36px] font-bold leading-[1.05] tracking-[-0.02em] text-white md:text-[52px] lg:text-[64px] xl:text-[72px]"
          style={{
            textAlign: "center",
            margin: "0 auto",
            maxWidth: "960px",
          }}
        >
          Ready to build something{" "}
          <span className="port-serif italic font-medium text-[#E8D5A8]">
            remarkable?
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 text-[16px] leading-[1.65] text-[rgba(251,249,244,0.72)] md:text-[18px]"
          style={{
            textAlign: "center",
            margin: "24px auto 0",
            maxWidth: "640px",
          }}
        >
          Talk to our team — free site visit and consultation for your next project. We&apos;ll respond within 24 hours.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4"
          style={{ textAlign: "center" }}
        >
          <a
            href="https://calendly.com/hagerstone-sales/30min"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#E8D5A8] px-8 py-4 text-[14px] font-semibold tracking-[0.04em] text-[#1A1612] no-underline transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#FBE9C0] hover:shadow-[0_12px_28px_rgba(232,213,168,0.40)]"
          >
            Book a Free Consultation
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path
                d="M5 12h14M13 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href="tel:+919980813555"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(251,249,244,0.25)] bg-transparent px-8 py-4 text-[14px] font-semibold tracking-[0.04em] text-white no-underline backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E8D5A8] hover:bg-[rgba(232,213,168,0.08)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Call Us Now
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-28 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 md:mt-32"
          style={{
            textAlign: "left",
            maxWidth: "960px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {CONTACT_METHODS.map((method, idx) => {
            const Container = method.href ? "a" : "div"
            const containerProps = method.href
              ? {
                  href: method.href,
                  ...(method.href.startsWith("http")
                    ? { target: "_blank", rel: "noreferrer" }
                    : {}),
                }
              : {}

            return (
              <motion.div
                key={method.label}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.85 + idx * 0.08 }}
              >
                <Container
                  {...containerProps}
                  className="group flex h-full items-center gap-4 rounded-2xl border border-[rgba(232,213,168,0.20)] bg-[rgba(251,249,244,0.04)] p-5 no-underline backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(232,213,168,0.45)] hover:bg-[rgba(232,213,168,0.08)]"
                >
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(232,213,168,0.35)] bg-[rgba(232,213,168,0.10)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[rgba(232,213,168,0.22)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d={method.iconPath}
                        stroke="#E8D5A8"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {method.secondaryPath ? (
                        <path
                          d={method.secondaryPath}
                          stroke="#E8D5A8"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] tracking-[0.18em] text-[rgba(251,249,244,0.55)]">
                      {method.label}
                    </div>
                    <div className="mt-1 truncate font-syne text-[14px] font-semibold text-white transition-colors group-hover:text-[#E8D5A8] md:text-[15px]">
                      {method.value}
                    </div>
                    {method.helper ? (
                      <div className="mt-0.5 truncate text-[11px] text-[rgba(251,249,244,0.50)]">
                        {method.helper}
                      </div>
                    ) : null}
                  </div>
                </Container>
              </motion.div>
            )
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.05 }}
          className="mx-auto mt-16 flex flex-col items-center justify-center gap-4 border-t border-[rgba(232,213,168,0.18)] pt-12 sm:flex-row sm:gap-6"
          style={{ maxWidth: "960px" }}
        >
          <div className="inline-flex items-center gap-2.5 text-[11px] font-medium tracking-[0.22em] text-[#E8D5A8]">
            <span className="h-px w-8 bg-[#E8D5A8]" />
            FOLLOW THE JOURNEY
          </div>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social, idx) => (
              <motion.a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${social.label} — ${social.handle}`}
                title={`${social.label} · ${social.handle}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={
                  isInView
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.85 }
                }
                transition={{
                  duration: 0.4,
                  delay: 1.15 + idx * 0.08,
                  ease: [0.4, 0, 0.2, 1],
                }}
                whileHover={{ y: -4, scale: 1.08 }}
                className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[rgba(232,213,168,0.28)] bg-[rgba(251,249,244,0.05)] text-[#E8D5A8] no-underline backdrop-blur-sm transition-colors duration-300 hover:border-transparent hover:text-white"
              >
                <span
                  className="pointer-events-none absolute inset-0 scale-0 rounded-full transition-transform duration-400 ease-out group-hover:scale-100"
                  style={{ background: social.brandBg }}
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="relative z-[1]"
                >
                  <path
                    d={social.iconPath}
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.a>
            ))}
          </div>
          <span className="hidden text-[12px] text-[rgba(251,249,244,0.55)] sm:inline">
            @hagerstone_international
          </span>
        </motion.div>
      </div>
    </section>
  )
}
