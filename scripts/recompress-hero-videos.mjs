#!/usr/bin/env node
// One-time script: downloads hero MP4s from Supabase, recompresses with
// ffmpeg (H.264, max 1920px wide, 2 Mbps target), backs up originals
// locally, then uploads the compressed file back, overwriting.
//
// Usage: node scripts/recompress-hero-videos.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import ffmpegPath from "ffmpeg-static"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ── Load env ─────────────────────────────────────────────────────────
const envText = readFileSync(resolve(ROOT, ".env.local"), "utf8")
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=")
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, "")]
    }),
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local")
}
const BUCKET = "portfolio"
const BACKUP_DIR = resolve(ROOT, "portfolio-originals-backup")
const TMP_DIR = resolve(ROOT, ".tmp-video-compress")
mkdirSync(BACKUP_DIR, { recursive: true })
mkdirSync(TMP_DIR, { recursive: true })

const FILES = [
  "hero-videos/1.mp4",
  "hero-videos/2.mp4",
]

const headers = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
}

console.log(`Using ffmpeg at: ${ffmpegPath}`)
console.log(`Processing ${FILES.length} videos...\n`)

let processed = 0
let skipped = 0
let failed = 0

for (const path of FILES) {
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`
  const backupPath = resolve(BACKUP_DIR, path.replace(/\//g, "_"))
  const tmpInput = resolve(TMP_DIR, "in_" + path.replace(/\//g, "_"))
  const tmpOutput = resolve(TMP_DIR, "out_" + path.replace(/\//g, "_"))

  try {
    console.log(`[${path}]`)

    // 1. Download original
    const dlStart = Date.now()
    const dlRes = await fetch(publicUrl)
    if (!dlRes.ok) {
      console.log(`  [skip] download failed (${dlRes.status})`)
      failed++
      continue
    }
    const originalBuf = Buffer.from(await dlRes.arrayBuffer())
    const originalMB = (originalBuf.length / 1024 / 1024).toFixed(2)
    console.log(`  downloaded ${originalMB}MB in ${Date.now() - dlStart}ms`)

    if (originalBuf.length < 10 * 1024 * 1024) {
      console.log(`  [skip] already ${originalMB}MB, under 10MB`)
      skipped++
      continue
    }

    // 2. Backup
    if (!existsSync(backupPath)) {
      writeFileSync(backupPath, originalBuf)
      console.log(`  backup saved`)
    } else {
      console.log(`  backup already exists`)
    }

    // 3. Write to tmp input file (ffmpeg needs a file path)
    writeFileSync(tmpInput, originalBuf)

    // 4. Recompress: H.264, max 1920px wide preserving aspect, CRF 28
    //    (visually transparent for hero/background video), faststart for
    //    quick start over HTTP, drop audio (it's a silent loop anyway).
    const compressStart = Date.now()
    const result = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i", tmpInput,
        "-vf", "scale='min(1920,iw)':-2",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an", // strip audio
        tmpOutput,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    )
    if (result.status !== 0) {
      console.log(`  [FAIL] ffmpeg exit ${result.status}: ${result.stderr?.toString().slice(-300)}`)
      failed++
      continue
    }
    const compressedBuf = readFileSync(tmpOutput)
    const compressedMB = (compressedBuf.length / 1024 / 1024).toFixed(2)
    console.log(`  compressed to ${compressedMB}MB in ${((Date.now() - compressStart) / 1000).toFixed(1)}s`)

    // 5. Upload back
    const upStart = Date.now()
    const upRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: compressedBuf,
    })
    if (!upRes.ok) {
      const errText = await upRes.text()
      console.log(`  [FAIL] upload ${upRes.status}: ${errText.slice(0, 200)}`)
      failed++
      continue
    }
    console.log(`  uploaded in ${((Date.now() - upStart) / 1000).toFixed(1)}s`)
    console.log(`  ✓ ${originalMB}MB → ${compressedMB}MB`)
    processed++

    // Cleanup tmp
    try { unlinkSync(tmpInput) } catch {}
    try { unlinkSync(tmpOutput) } catch {}
  } catch (err) {
    console.log(`  [ERR] ${err.message}`)
    failed++
  }
}

console.log(`\nDone. Processed: ${processed}  Skipped: ${skipped}  Failed: ${failed}`)
console.log(`Backups saved to: ${BACKUP_DIR}`)
