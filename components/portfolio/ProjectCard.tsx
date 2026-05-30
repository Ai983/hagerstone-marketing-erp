"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react"

import type { Project } from "@/lib/portfolio-data"
import { portfolioImage } from "@/lib/utils/portfolio-media"

type ProjectCardProps = {
  project: Project
  accentColor: string
}

export function ProjectCard({ project, accentColor }: ProjectCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const hasMultipleImages = project.images.length > 1
  const allImagesFailed = project.images.length === 0 || project.images.every((_, index) => imgErrors[index])

  useEffect(() => {
    setCurrentIndex(0)
    setImgErrors({})
  }, [project.id])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (!hasMultipleImages || isPaused) return
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % project.images.length)
    }, 3800)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [hasMultipleImages, isPaused, project.images.length])

  const pauseAndSetIndex = (index: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setCurrentIndex(index)
  }

  const showPrevious = () => pauseAndSetIndex(currentIndex === 0 ? project.images.length - 1 : currentIndex - 1)
  const showNext = () => pauseAndSetIndex((currentIndex + 1) % project.images.length)

  return (
    <article
      className="project-card group relative overflow-hidden rounded-[20px] border bg-[var(--port-card)] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        borderColor: isHovered ? "var(--port-border-hover)" : "var(--port-border)",
        transform: isHovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: isHovered ? "var(--port-shadow-xl)" : "var(--port-shadow-md)",
      }}
      onMouseEnter={() => {
        setIsPaused(true)
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsPaused(false)
        setIsHovered(false)
      }}
    >
      <div
        className="relative w-full overflow-hidden bg-[var(--port-bg-soft)]"
        style={{ paddingBottom: "66%" }}
      >
        {project.images.map((src, index) => (
          <div
            key={`${project.id}-${index}`}
            style={{
              position: "absolute",
              inset: 0,
              opacity: index === currentIndex ? 1 : 0,
              transition: "opacity 900ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {!imgErrors[index] ? (
              <img
                src={portfolioImage(src, { width: 1000, quality: 72 })}
                alt={project.title + " photo " + (index + 1)}
                loading={index === 0 ? "eager" : "lazy"}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: isHovered ? "scale(1.08)" : "scale(1.02)",
                  transition: "transform 1200ms cubic-bezier(0.4,0,0.2,1)",
                }}
                onError={() => setImgErrors((prev) => ({ ...prev, [index]: true }))}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--port-bg-soft)] px-6 text-center font-syne text-[14px] tracking-[0.15em] text-[var(--port-muted)]">
                {project.title.toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {allImagesFailed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--port-bg-soft)] px-6 text-center font-syne text-[14px] tracking-[0.12em] text-[var(--port-muted)]">
            {project.title.toUpperCase()}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-transparent from-[40%] via-[rgba(26,22,18,0.15)] via-[75%] to-[rgba(26,22,18,0.55)]" />

        {project.sectorId !== "mep" ? (
          <div
            className="absolute right-3 top-3 z-[3] flex items-center gap-1.5 rounded-full border bg-[rgba(255,255,255,0.92)] px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] text-[var(--port-ink)] backdrop-blur-md"
            style={{ borderColor: "rgba(255,255,255,0.6)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: accentColor }}
            />
            {project.year}
          </div>
        ) : null}

        {hasMultipleImages ? (
          <div
            className="absolute left-3 top-3 z-[3] rounded-full border bg-[rgba(26,22,18,0.65)] px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-white backdrop-blur-md"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            {String(currentIndex + 1).padStart(2, "0")} / {String(project.images.length).padStart(2, "0")}
          </div>
        ) : null}

        {hasMultipleImages ? (
          <>
            <div className="absolute bottom-3 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.85)] px-2.5 py-1.5 backdrop-blur-md">
              {project.images.map((image, index) => (
                <button
                  key={`${image}-dot`}
                  type="button"
                  aria-label={`Show photo ${index + 1}`}
                  onClick={() => pauseAndSetIndex(index)}
                  className="rounded-full border-0 p-0 transition-all duration-300"
                  style={{
                    background: index === currentIndex ? "var(--port-ink)" : "rgba(26,22,18,0.25)",
                    width: index === currentIndex ? 18 : 6,
                    height: 6,
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={showPrevious}
              className="arrow-btn absolute left-3 top-1/2 z-[3] flex h-10 w-10 items-center justify-center rounded-full border bg-[rgba(255,255,255,0.95)] text-[var(--port-ink)] shadow-md backdrop-blur-md transition-all duration-300 hover:bg-[var(--port-ink)] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.6)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={showNext}
              className="arrow-btn absolute right-3 top-1/2 z-[3] flex h-10 w-10 items-center justify-center rounded-full border bg-[rgba(255,255,255,0.95)] text-[var(--port-ink)] shadow-md backdrop-blur-md transition-all duration-300 hover:bg-[var(--port-ink)] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.6)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      <div className="px-6 pb-6 pt-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--port-muted)]">
          <span className="h-1 w-1 rounded-full" style={{ background: accentColor }} />
          {project.client}
        </div>

        <h3 className="font-syne mb-3 text-[20px] font-bold leading-tight text-[var(--port-ink)] transition-colors duration-300 group-hover:text-[var(--port-accent-deep)]">
          {project.title}
        </h3>

        <div className="mb-5 flex flex-wrap justify-center gap-1.5">
          {[project.city, project.areaSqft, project.scope]
            .filter((tag) => tag && tag !== "TBD")
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--port-border-soft)] bg-[var(--port-bg-soft)] px-3 py-1 text-[10px] font-medium tracking-[0.04em] text-[var(--port-secondary)]"
              >
                {tag}
              </span>
            ))}
        </div>

        <div className="flex items-center justify-center gap-4 border-t border-[var(--port-border-soft)] pt-4">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--port-accent-deep)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 15.3 6.8 18l1-5.8L3.6 8.1l5.8-.8L12 2z" fill="var(--port-accent)" />
            </svg>
            {project.highlight}
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--port-border)] bg-[var(--port-bg-soft)] text-[var(--port-secondary)] transition-all duration-300 group-hover:border-[var(--port-accent)] group-hover:bg-[var(--port-accent)] group-hover:text-white group-hover:rotate-[-45deg]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </article>
  )
}
