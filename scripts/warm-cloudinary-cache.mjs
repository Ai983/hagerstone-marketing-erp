#!/usr/bin/env node
// One-time script: pre-fetches every portfolio image via Cloudinary so the
// CDN cache is warm before real users hit the page. Run after deploy.
//
// Usage: node scripts/warm-cloudinary-cache.mjs

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const CLOUDINARY_CLOUD = "dv9znt7kq"
const SUPABASE_BASE =
  "https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = resolve(__dirname, "..", "lib", "portfolio-data.ts")

const src = readFileSync(DATA_FILE, "utf8")
const matches = src.match(/"\/portfolio\/[^"]+\.(?:jpg|jpeg|png|webp)"/gi) ?? []
const paths = Array.from(new Set(matches.map((m) => m.slice(1, -1))))

// Widths used by the portfolio components.
// Logos hit 280 (mobile) + 400 (desktop); hero photos hit 1280 + 1920;
// project cards hit 1000. We warm the most-used width for each.
function widthsFor(path) {
  if (path.startsWith("/portfolio/clients/")) return [280, 400]
  // Hero slide photos are the same files used in ProjectCard for now, so
  // covering 1000 + 1920 ensures both code paths are warm.
  return [1000, 1920]
}

// Keep CACHE_VERSION in sync with portfolio-media.ts.
const CACHE_VERSION = "2"

function buildUrl(path, width) {
  const supabaseUrl = `${SUPABASE_BASE}${path}?v=${CACHE_VERSION}`
  const encoded = encodeURIComponent(supabaseUrl)
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/w_${width},q_auto,f_auto/${encoded}`
}

const urls = paths.flatMap((p) => widthsFor(p).map((w) => buildUrl(p, w)))
console.log(`Warming ${urls.length} URLs across ${paths.length} unique images...`)

let done = 0
let failed = 0
const start = Date.now()

async function warm(url, attempt = 1) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { method: "GET" })
    const ms = Date.now() - t0
    if (!res.ok) {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 500 * attempt))
        return warm(url, attempt + 1)
      }
      failed++
      console.log(
        `  [FAIL ${res.status} after ${attempt}x] ${ms}ms  ${url.slice(-80)}`,
      )
    } else {
      const size = Number(res.headers.get("content-length") ?? 0)
      console.log(
        `  [ok  ${String(++done).padStart(3, " ")}/${urls.length}] ${String(ms).padStart(5, " ")}ms  ${String((size / 1024).toFixed(0)).padStart(5, " ")}KB  ${url.slice(-60)}`,
      )
    }
  } catch (err) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * attempt))
      return warm(url, attempt + 1)
    }
    failed++
    console.log(`  [ERR] ${url.slice(-80)}: ${err.message}`)
  }
}

// Run with concurrency 3 to stay under Cloudinary's burst threshold.
const CONCURRENCY = 3
const queue = [...urls]
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const url = queue.shift()
    if (url) await warm(url)
  }
})
await Promise.all(workers)

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\nDone in ${elapsed}s. Failed: ${failed}/${urls.length}`)
