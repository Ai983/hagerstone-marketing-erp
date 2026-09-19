"use client"

import { cn } from "@/lib/utils"
import { OBJECTIONS } from "@/lib/utils/objections"

/** "Objections heard" tap chips for Log Call / Log Meeting. Optional, multi-select. */
export function ObjectionPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
        Objections heard <span className="normal-case tracking-normal text-[#5A5A72]">(optional — tap all that apply)</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {OBJECTIONS.map((o) => {
          const on = value.includes(o.key)
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              aria-pressed={on}
              className={cn(
                "touch-manipulation rounded-full border px-2.5 py-1.5 text-xs transition",
                on
                  ? "border-[#F59E0B] bg-[#F59E0B]/15 text-[#FBBF24]"
                  : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
