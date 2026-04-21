"use client"

import type { ReactNode } from "react"

interface AIAgentPanelProps {
  number: number
  title: string
  subtitle?: string
  icon: ReactNode
  children: ReactNode
}

/**
 * Section wrapper for the AI Agent page. Numbered, titled card with
 * a subtle icon badge in the header.
 */
export function AIAgentPanel({
  number,
  title,
  subtitle,
  icon,
  children,
}: AIAgentPanelProps) {
  return (
    <section className="rounded-xl border border-[#2A2A3C] bg-[#0F0F15] p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-xs font-semibold text-[#3B82F6]">
          {number}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA]">
              {title}
            </h2>
            <span className="text-[#9090A8]">{icon}</span>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-[#9090A8]">{subtitle}</p>}
        </div>
      </header>
      <div>{children}</div>
    </section>
  )
}
