'use client'

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const TESTIMONIALS = [
  {
    text: "Throughout the project, Hagerstone International demonstrated remarkable project management skills. They kept Statkraft informed at every step, followed timelines, and stayed within budget. Their commitment to quality and client satisfaction is truly commendable.",
    name: "Statkraft",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/Statkraft.png",
    sector: "Office Interiors",
  },
  {
    text: "Your team managed the project professionally, delivering exceptional quality. Completing the entire building construction within 60 days was impressive and satisfying. Your quick response time consistently enabled Imperial Malts to make informed decisions efficiently throughout the process.",
    name: "Imperial Malts",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/Imperial Malts.png",
    sector: "Construction",
  },
  {
    text: "We loved your team’s positivity and professionalism. Before working with Hagerstone, Hashtag Orange never imagined office interiors could be done so smoothly. The project was hassle-free, completed with top-notch quality, and delivered within our 45-day timeline. Truly impressive!",
    name: "Hashtag Orange",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/Hashtag Orange.png",
    sector: "Office Interiors",
  },
  {
    text: "EDF France is satisfied with the office delivered and with the quality of work. The project was completed within the timeline, and we look forward to collaborating with Hagerstone International on future projects. Best wishes for their endeavors.",
    name: "EDF France",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/EDF France.png",
    sector: "Office Interiors",
  },
  {
    text: "TAJ Hotels had a unique gym lounge design challenge, and Hagerstone exceeded our expectations. They understood our vision, incorporated ideas beautifully, and ensured flawless execution. The result is a stunning, functional space perfect for our needs. Highly recommended!",
    name: "TAJ Hotels",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/Taj.png",
    sector: "Hospitality",
  },
  {
    text: "Inshorts Media hired Hagerstone International to design and build our new office space interiors. Their expertise and experience truly stood out. We are extremely satisfied with their work and look forward to working with them again in the future.",
    name: "Inshorts Media",
    role: "Client",
    logo: "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public/portfolio/clients/Inshorts.png",
    sector: "Office Interiors",
  },
]

const col1 = TESTIMONIALS.slice(0, 2)
const col2 = TESTIMONIALS.slice(2, 4)
const col3 = TESTIMONIALS.slice(4, 6)

type Testimonial = (typeof TESTIMONIALS)[number]

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EAE4D8",
        borderRadius: 20,
        padding: 28,
        width: "100%",
        maxWidth: 340,
        boxShadow: "0 4px 20px rgba(28,26,20,0.06)",
        transition: "border-color 200ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(184,134,11,0.3)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#EAE4D8"
      }}
    >
      {/* Top row: stars + sector pill */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            color: "#C9A84C",
            fontSize: 14,
            letterSpacing: 2,
          }}
        >
          {"★★★★★"}
        </div>
        <div
          style={{
            background: "rgba(184,134,11,0.08)",
            border: "1px solid rgba(184,134,11,0.15)",
            color: "#B8860B",
            fontSize: 10,
            letterSpacing: "0.1em",
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          {testimonial.sector}
        </div>
      </div>

      {/* Quote text */}
      <p
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: 14,
          lineHeight: 1.75,
          color: "#4A4235",
          fontStyle: "italic",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            color: "rgba(201,168,76,0.2)",
            fontSize: 24,
            marginRight: 4,
            lineHeight: 1,
          }}
        >
          {"“"}
        </span>
        {testimonial.text}
      </p>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "#EAE4D8",
          marginBottom: 16,
        }}
      />

      {/* Client row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={testimonial.logo}
          alt={testimonial.name}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            objectFit: "contain",
            background: "#FAF8F4",
            border: "1px solid #EAE4D8",
            padding: 4,
          }}
          onError={(e) => {
            const img = e.currentTarget
            img.style.display = "none"
            const parent = img.parentNode
            if (!parent) return
            // Avoid inserting fallback twice
            if (
              (parent as HTMLElement).querySelector(
                "[data-logo-fallback='true']"
              )
            ) {
              return
            }
            const initials = testimonial.name
              .split(" ")
              .map((word) => word.charAt(0))
              .slice(0, 2)
              .join("")
              .toUpperCase()
            const fallback = document.createElement("span")
            fallback.setAttribute("data-logo-fallback", "true")
            fallback.textContent = initials
            fallback.style.width = "40px"
            fallback.style.height = "40px"
            fallback.style.borderRadius = "8px"
            fallback.style.display = "flex"
            fallback.style.alignItems = "center"
            fallback.style.justifyContent = "center"
            fallback.style.background = "#FAF8F4"
            fallback.style.color = "#B8860B"
            fallback.style.fontFamily = "Syne, sans-serif"
            fallback.style.fontSize = "14px"
            fallback.style.fontWeight = "700"
            fallback.style.border = "1px solid #EAE4D8"
            parent.insertBefore(fallback, img)
          }}
        />
        <div>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "#1C1A14",
              lineHeight: 1.2,
            }}
          >
            {testimonial.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#9A8E78",
              marginTop: 2,
            }}
          >
            {testimonial.role}
          </div>
        </div>
      </div>
    </div>
  )
}

function TestimonialsColumn({
  testimonials,
  duration = 18,
  className,
}: {
  testimonials: Testimonial[]
  duration?: number
  className?: string
}) {
  return (
    <div className={className} style={{ overflow: "hidden" }}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          paddingBottom: 20,
        }}
      >
        {[...testimonials, ...testimonials].map((t, i) => (
          <TestimonialCard testimonial={t} key={i} />
        ))}
      </motion.div>
    </div>
  )
}

export function TestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      id="testimonials"
      className="port-section"
      style={{
        padding: "110px 10vw",
        background: "#FFFFFF",
        borderTop: "1px solid #EAE4D8",
        borderBottom: "1px solid #EAE4D8",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 768px) { .hidden-mobile { display: none; } }
            @media (max-width: 1024px) { .hidden-tablet { display: none; } }
          `,
        }}
      />

      {/* Section header */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{ textAlign: "center", marginBottom: 56 }}
      >
        {/* Small label row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: 32,
              height: 1,
              background: "#C9A84C",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.3em",
              color: "#B8860B",
              textTransform: "uppercase",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Client Voices
          </span>
        </div>

        {/* Heading */}
        <h2 style={{ marginTop: 16, lineHeight: 1.15 }}>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "clamp(28px, 7vw, 42px)",
              fontWeight: 700,
              color: "#1C1A14",
            }}
          >
            What clients{" "}
          </span>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(28px, 7vw, 42px)",
              fontWeight: 700,
              color: "#C9A84C",
            }}
          >
            say
          </span>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "clamp(28px, 7vw, 42px)",
              fontWeight: 700,
              color: "#1C1A14",
            }}
          >
            {" "}
            about us
          </span>
        </h2>

        {/* Sub */}
        <p
          style={{
            marginTop: 12,
            fontFamily: "DM Sans, sans-serif",
            fontSize: 15,
            color: "#9A8E78",
            textAlign: "center",
          }}
        >
          Real feedback from the companies we have built for.
        </p>

        {/* Rating row */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              color: "#C9A84C",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            {"★★★★★"}
          </span>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 600,
              color: "#1C1A14",
              fontSize: 16,
            }}
          >
            4.9 / 5.0
          </span>
          <span
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: 13,
              color: "#9A8E78",
            }}
          >
            from 200+ clients
          </span>
        </div>
      </motion.div>

      {/* Columns wrapper */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginTop: 0,
          maskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          maxHeight: 740,
          overflow: "hidden",
        }}
      >
        <TestimonialsColumn testimonials={col1} duration={18} />
        <TestimonialsColumn
          testimonials={col2}
          duration={22}
          className="hidden-mobile"
        />
        <TestimonialsColumn
          testimonials={col3}
          duration={20}
          className="hidden-tablet"
        />
      </div>
    </section>
  )
}
