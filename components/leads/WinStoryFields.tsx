"use client"

import { WIN_QUESTIONS, type WinStory } from "@/lib/utils/win-story"

/** The three "why they bought" inputs, used in the Won step and the lead drawer. */
export function WinStoryFields({ value, onChange }: { value: WinStory; onChange: (next: WinStory) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.05em] text-[#9090A8]">
        Why they bought <span className="normal-case tracking-normal text-[#5A5A72]">(optional — one line each)</span>
      </p>
      <div className="space-y-2">
        {WIN_QUESTIONS.map((q) => (
          <label key={q.key} className="block">
            <span className="mb-1 block text-[11px] text-[#9090A8]">{q.label}</span>
            <input
              value={value[q.key]}
              onChange={(e) => onChange({ ...value, [q.key]: e.target.value })}
              placeholder={q.placeholder}
              className="w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-2.5 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none transition focus:border-[#3B82F6] md:text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
