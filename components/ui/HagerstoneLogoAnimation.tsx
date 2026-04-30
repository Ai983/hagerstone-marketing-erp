"use client"

import React from "react"

interface Props {
  size?: number
}

export const HagerstoneLogoAnimation: React.FC<Props> = ({ size = 280 }) => {
  const arcs = [
    { radius: 60, strokeWidth: 1.5, rotation: 0, delay: 0, duration: 30 },
    { radius: 65, strokeWidth: 1.2, rotation: 15, delay: 0.1, duration: 25 },
    { radius: 70, strokeWidth: 1.5, rotation: 0, delay: 0, duration: 28 },
    { radius: 75, strokeWidth: 1.2, rotation: 45, delay: 0.15, duration: 28 },
    { radius: 80, strokeWidth: 1.5, rotation: 30, delay: 0.2, duration: 25 },
    { radius: 85, strokeWidth: 1.2, rotation: 75, delay: 0.25, duration: 22 },
    { radius: 90, strokeWidth: 1.5, rotation: 60, delay: 0.4, duration: 20 },
    { radius: 95, strokeWidth: 1.2, rotation: 105, delay: 0.45, duration: 18 },
    { radius: 100, strokeWidth: 1.5, rotation: 90, delay: 0.6, duration: 15 },
    { radius: 105, strokeWidth: 1.2, rotation: 135, delay: 0.7, duration: 12 },
    { radius: 110, strokeWidth: 1.5, rotation: 120, delay: 0.8, duration: 10 },
    { radius: 115, strokeWidth: 1.2, rotation: 150, delay: 0.9, duration: 8 },
    { radius: 120, strokeWidth: 1.5, rotation: 180, delay: 1.0, duration: 25 },
    { radius: 125, strokeWidth: 1.2, rotation: 210, delay: 1.1, duration: 28 },
  ]

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ overflow: "visible" }}
      >
        <defs>
          <style>{`
            @keyframes spinArc {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @keyframes spinArcReverse {
              from { transform: rotate(360deg); }
              to   { transform: rotate(0deg); }
            }
          `}</style>

          <linearGradient
            id="goldGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#F5D27A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#8B6914" stopOpacity="0.5" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {arcs.map((arc, index) => (
          <path
            key={index}
            d={`M ${100 - arc.radius} 100 a ${arc.radius} ${arc.radius} 0 0 1 ${
              arc.radius * 2
            } 0`}
            stroke="url(#goldGradient)"
            strokeWidth={arc.strokeWidth}
            fill="none"
            filter="url(#glow)"
            style={{
              transformOrigin: "100px 100px",
              transform: `rotate(${arc.rotation}deg)`,
              animation: `${index % 2 === 0 ? "spinArc" : "spinArcReverse"} ${
                arc.duration
              }s ${arc.delay}s infinite linear`,
              opacity: 0.6 + index * 0.02,
            }}
          />
        ))}

        <circle
          cx="100"
          cy="100"
          r="48"
          fill="rgba(0,0,0,0.4)"
          stroke="rgba(201,168,76,0.3)"
          strokeWidth="1"
        />

        <image
          href="/logo.png"
          x="62"
          y="62"
          width="76"
          height="76"
          style={{
            filter: "brightness(1.1)",
            objectFit: "contain",
          }}
        />
      </svg>
    </div>
  )
}
