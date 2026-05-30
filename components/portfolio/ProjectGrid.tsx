"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useInView, type Variants } from "framer-motion"

import type { Sector } from "@/lib/portfolio-data"

import { ProjectCard } from "./ProjectCard"

type ProjectGridProps = {
  sector: Sector
}

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export function ProjectGrid({ sector }: ProjectGridProps) {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setShowAll(false)
  }, [sector.id])

  const visibleProjects = showAll ? sector.projects : sector.projects.slice(0, 6)

  return (
    <motion.section
      id="projects"
      ref={sectionRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE }}
      className="port-section relative bg-[var(--port-bg)] px-6 md:px-12 lg:px-[8vw]"
    >
      <div className="mb-12" style={{ textAlign: "center" }}>
        <div className="port-eyebrow mb-5" style={{ justifyContent: "center" }}>
          Our Work · Featured Projects
        </div>
        <h2
          className="font-syne text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--port-ink)] md:text-[52px]"
          style={{ marginLeft: "auto", marginRight: "auto", textAlign: "center" }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={sector.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="inline-block"
            >
              {sector.label} <span className="port-serif italic font-medium text-[var(--port-accent-deep)]">portfolio</span>
            </motion.span>
          </AnimatePresence>
        </h2>
        <p
          className="mt-5 text-[16px] leading-[1.65] text-[var(--port-secondary)]"
          style={{ marginLeft: "auto", marginRight: "auto", maxWidth: 700, textAlign: "center" }}
        >
          Each space we deliver is a careful blend of design vision, engineering precision, and craft. Browse a curated selection of our recent work below.
        </p>

        {sector.id !== "mep" ? (
          <div className="mt-6 flex items-center justify-center gap-6 text-[12px] text-[var(--port-muted)]">
            <div className="flex items-baseline gap-2">
              <span className="font-syne text-[28px] font-bold leading-none text-[var(--port-ink)]">
                {String(sector.projects.length).padStart(2, "0")}
              </span>
              <span className="tracking-[0.12em] uppercase">Projects</span>
            </div>
            <div className="h-8 w-px bg-[var(--port-border)]" />
            <div className="flex items-baseline gap-2">
              <span className="font-syne text-[28px] font-bold leading-none text-[var(--port-accent-deep)]">{sector.services.length}</span>
              <span className="tracking-[0.12em] uppercase">Services</span>
            </div>
          </div>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={sector.id}
          variants={container}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {visibleProjects.map((project) => (
            <motion.div key={project.id} variants={item}>
              <ProjectCard project={project} accentColor={sector.accentColor} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {sector.projects.length > 6 ? (
        <div className="flex justify-center" style={{ marginTop: 64 }}>
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="group inline-flex items-center gap-3 rounded-full border border-[var(--port-border-hover)] bg-[var(--port-surface)] px-8 py-4 text-[13px] font-semibold tracking-[0.04em] text-[var(--port-ink)] transition-all duration-300 hover:bg-[var(--port-ink)] hover:text-[var(--port-bg)] hover:shadow-lg hover:-translate-y-0.5"
          >
            {showAll ? "Show Less" : `View ${sector.projects.length - 6} More Projects`}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="transition-transform duration-300 group-hover:translate-x-1"
              style={{ transform: showAll ? "rotate(180deg)" : "none" }}
            >
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <div
        className="mt-20 h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent, var(--port-border), transparent)",
        }}
      />
    </motion.section>
  )
}
