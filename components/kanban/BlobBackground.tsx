"use client"

import { useEffect, useRef } from "react"

interface Blob {
  /** Center x as fraction of canvas width (0..1) */
  x: number
  /** Center y as fraction of canvas height (0..1) */
  y: number
  /** Radius as fraction of min(width, height) */
  r: number
  /** RGB tuple prefix — opacity is appended later */
  color: string
  /** Phase offset so blobs aren't synchronised */
  phase: number
  /** Drift speed (radians per ms) */
  speed: number
}

const blobs: Blob[] = [
  { x: 0.15, y: 0.25, r: 0.32, color: "rgba(59,130,246,",  phase: 0,   speed: 0.0004  },
  { x: 0.82, y: 0.55, r: 0.28, color: "rgba(139,92,246,",  phase: 2.1, speed: 0.0003  },
  { x: 0.45, y: 0.85, r: 0.26, color: "rgba(16,185,129,",  phase: 4.2, speed: 0.00035 },
  { x: 0.12, y: 0.72, r: 0.20, color: "rgba(245,158,11,",  phase: 1.0, speed: 0.00045 },
  { x: 0.88, y: 0.18, r: 0.24, color: "rgba(236,72,153,",  phase: 3.1, speed: 0.00028 },
]

const POINTS_PER_BLOB = 8
const SPIKINESS = 0.15

/**
 * Animated blob background. Five organic shapes drift slowly using
 * sine/cosine oscillation and react to the mouse with a subtle parallax
 * (alternating directions per blob, smoothed via lerp).
 *
 * The canvas is fixed to the viewport, sits at z-index 0, and never
 * receives pointer events — drag-and-drop and clicks always reach the
 * Kanban content above it.
 */
export function BlobBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let dpr = Math.max(1, window.devicePixelRatio || 1)
    // With position: absolute the canvas sizes to its containing block,
    // not the viewport — read the rendered size from the element itself.
    let width = canvas.clientWidth || window.innerWidth
    let height = canvas.clientHeight || window.innerHeight

    const resize = () => {
      dpr = Math.max(1, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      width = rect.width || canvas.clientWidth || window.innerWidth
      height = rect.height || canvas.clientHeight || window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // Watch the canvas for size changes (e.g. sidebar collapse) — window
    // resize alone misses this since the parent layout reflows the
    // canvas without the viewport changing.
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    // Mouse tracking — raw target + smoothed value (lerp toward target)
    let targetMouseX = width / 2
    let targetMouseY = height / 2
    let mouseX = targetMouseX
    let mouseY = targetMouseY

    const onMouseMove = (e: MouseEvent) => {
      // Convert viewport mouse position to canvas-local coordinates
      const rect = canvas.getBoundingClientRect()
      targetMouseX = e.clientX - rect.left
      targetMouseY = e.clientY - rect.top
    }

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouseMove)

    let rafId = 0
    const startTime = performance.now()

    const drawBlob = (blob: Blob, index: number, time: number) => {
      const minDim = Math.min(width, height)
      const baseR = blob.r * minDim

      // Slow drift via sine/cosine
      const driftX = Math.sin(time * blob.speed + blob.phase) * (minDim * 0.06)
      const driftY = Math.cos(time * blob.speed * 1.3 + blob.phase) * (minDim * 0.06)

      // Mouse parallax — alternating direction per blob
      const direction = index % 2 === 0 ? 1 : -1
      const parallaxStrength = 0.05 * direction
      const baseCx = blob.x * width + driftX
      const baseCy = blob.y * height + driftY
      const cx = baseCx + (mouseX - baseCx) * parallaxStrength
      const cy = baseCy + (mouseY - baseCy) * parallaxStrength

      // Pre-compute the perimeter points (organic, time-varying spikiness)
      const angleStep = (Math.PI * 2) / POINTS_PER_BLOB
      const pts: Array<{ x: number; y: number }> = []
      for (let i = 0; i < POINTS_PER_BLOB; i++) {
        const angle = i * angleStep + blob.phase
        const variation =
          1 + Math.sin(angle * 3 + time * blob.speed * 6 + blob.phase) * SPIKINESS
        const radius = baseR * variation
        pts.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        })
      }

      // Soft radial-gradient fill (color → transparent)
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR)
      gradient.addColorStop(0, `${blob.color}0.12)`)
      gradient.addColorStop(1, `${blob.color}0)`)
      ctx.fillStyle = gradient

      // Draw smooth closed path through the points using quadraticCurveTo
      // between midpoints — gives an organic blob shape.
      ctx.beginPath()
      const first = pts[0]
      const last = pts[pts.length - 1]
      const startMidX = (last.x + first.x) / 2
      const startMidY = (last.y + first.y) / 2
      ctx.moveTo(startMidX, startMidY)
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i]
        const next = pts[(i + 1) % pts.length]
        const midX = (cur.x + next.x) / 2
        const midY = (cur.y + next.y) / 2
        ctx.quadraticCurveTo(cur.x, cur.y, midX, midY)
      }
      ctx.closePath()
      ctx.fill()
    }

    const tick = () => {
      const now = performance.now()
      const time = now - startTime

      // Smooth mouse — lerp toward target
      mouseX += (targetMouseX - mouseX) * 0.04
      mouseY += (targetMouseY - mouseY) * 0.04

      ctx.clearRect(0, 0, width, height)

      // Use additive blending so overlapping blobs glow rather than darken
      ctx.globalCompositeOperation = "lighter"
      blobs.forEach((blob, idx) => drawBlob(blob, idx, time))
      ctx.globalCompositeOperation = "source-over"

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  )
}
