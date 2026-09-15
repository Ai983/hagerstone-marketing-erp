import type { ReactNode } from "react"

/**
 * Just enough Markdown for Dhruv sir's Sales Engine documents: headings,
 * paragraphs, bullet and numbered lists, tables, blockquotes, fenced
 * code, **bold**, _italic_, `code` and links. Not a general parser —
 * the docs are fixed, and pulling in a Markdown library for five files
 * isn't worth the bundle.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  // `_italic_` only at word edges, so SALES_PIPELINE.md stays a filename.
  const re = /(\*\*[^*]+\*\*|`[^`]+`|(?<!\w)_[^_\n]+_(?!\w)|https?:\/\/[^\s)|]+)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-[#F0F0FA]">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-[#1F1F2E] px-1 py-0.5 text-[0.9em] text-[#F0F0FA]">{tok.slice(1, -1)}</code>)
    else if (tok.startsWith("_")) out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    else out.push(<a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="break-all text-[#60A5FA] underline">{tok}</a>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function MarkdownDoc({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const key = `b${i}`

    if (!line.trim()) { i++; continue }

    if (line.startsWith("```")) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++])
      i++
      blocks.push(
        <pre key={key} className="thin-scrollbar overflow-x-auto rounded-lg bg-[#0F0F15] p-3 text-xs leading-relaxed text-[#C8C8DC]">{code.join("\n")}</pre>
      )
      continue
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const cls = h[1].length === 1
        ? "mt-2 text-xl font-bold text-[#F0F0FA]"
        : h[1].length === 2
          ? "mt-6 border-b border-[#2A2A3C] pb-1 text-base font-semibold text-[#F0F0FA]"
          : "mt-4 text-sm font-semibold text-[#F0F0FA]"
      blocks.push(<p key={key} className={cls}>{inline(h[2], key)}</p>)
      i++
      continue
    }

    if (line.startsWith("|")) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={key} className="thin-scrollbar overflow-x-auto rounded-lg border border-[#2A2A3C]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#15151D] text-[#F0F0FA]">
              <tr>{head.map((c, j) => <th key={j} className="px-3 py-2 font-semibold">{inline(c, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-t border-[#1F1F2E] align-top">
                  {r.map((c, j) => <td key={j} className="px-3 py-2">{inline(c, `${key}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (line.startsWith(">")) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""))
      blocks.push(
        <blockquote key={key} className="border-l-2 border-[#F59E0B] pl-3 text-[#C8C8DC]">{inline(quote.join(" "), key)}</blockquote>
      )
      continue
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""))
      const List = ordered ? "ol" : "ul"
      blocks.push(
        <List key={key} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${key}i${j}`)}</li>)}
        </List>
      )
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|```|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={key}>{inline(para.join(" "), key)}</p>)
  }

  return <div className="space-y-3 text-sm leading-relaxed text-[#9090A8]">{blocks}</div>
}
