import fs from "node:fs"
import path from "node:path"
import Link from "next/link"

import { MarkdownDoc } from "@/components/founder/MarkdownDoc"

// Read at build time: the documents are part of the repo and never
// change at runtime, so the page is rendered once and served static.
export const dynamic = "force-static"

const DOCS = [
  { file: "README.md", title: "Start here", blurb: "What the Sales Engine is, its tools and automations." },
  { file: "TEAM_PLAYBOOK.md", title: "Team Playbook", blurb: "Daily routine, stage owners and the non-negotiable rules." },
  { file: "SYSTEM_GUIDE.md", title: "System Guide", blurb: "The funnel model, colour code and ownership model." },
  { file: "DATA_DICTIONARY.md", title: "Data Dictionary", blurb: "Every column and code — and who's who." },
  { file: "PROJECT_HISTORY.md", title: "Project History", blurb: "How it was built and the key deals discovered." },
]

function readDoc(file: string) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "docs", "founder-sales-engine", file), "utf8")
  } catch {
    return null
  }
}

export default function FounderGuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <Link href="/founder-desk" className="text-xs text-[#9090A8] hover:text-[#F0F0FA]">← Founder Desk</Link>
      <h1 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
        Dhruv sir&apos;s Sales Engine documents
      </h1>
      <p className="mt-1 text-sm text-[#9090A8]">
        The originals, as shared on 14 Sep 2026. The artifacts and scheduled tasks they mention live in sir&apos;s own Claude account; their data now lives in the ERP.
      </p>

      <nav className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DOCS.map((d) => (
          <a key={d.file} href={`#${d.file}`} className="rounded-lg border border-[#2A2A3C] bg-[#111118] p-3 hover:border-[#3A3A52]">
            <span className="block text-sm font-medium text-[#F0F0FA]">{d.title}</span>
            <span className="block text-xs text-[#9090A8]">{d.blurb}</span>
          </a>
        ))}
      </nav>

      {DOCS.map((d) => {
        const source = readDoc(d.file)
        return (
          <section key={d.file} id={d.file} className="mt-6 scroll-mt-4 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 md:p-6">
            {source ? <MarkdownDoc source={source} /> : <p className="text-sm text-[#9090A8]">{d.file} is missing.</p>}
          </section>
        )
      })}
    </div>
  )
}
