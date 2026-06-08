#!/usr/bin/env node
// One-time script: recompresses oversized office interior photos so they
// fit under Cloudinary's free-tier 10MB source-file limit. Saves local
// backups first, then uploads recompressed JPEGs back to Supabase Storage,
// overwriting the originals.
//
// Usage: node scripts/recompress-office-interiors.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

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
mkdirSync(BACKUP_DIR, { recursive: true })

// ── File list (oversized office interior photos) ────────────────────
const FILES = [
  ...Array.from({ length: 9 }, (_, i) => `office-interiors/theon/${i + 1}.jpg`),
  ...[1, 2, 3, 5, 6].map((i) => `office-interiors/msc/${i}.jpg`),
  ...Array.from({ length: 5 }, (_, i) => `office-interiors/oceaneering/${i + 1}.jpeg`),
]

console.log(`Processing ${FILES.length} files...\n`)

const headers = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
}

let processed = 0
let skipped = 0
let failed = 0

for (const path of FILES) {
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`
  const backupPath = resolve(BACKUP_DIR, path.replace(/\//g, "_"))

  try {
    // 1. Download
    const downloadStart = Date.now()
    const dlRes = await fetch(publicUrl)
    if (!dlRes.ok) {
      console.log(`  [skip] ${path} — download failed (${dlRes.status})`)
      failed++
      continue
    }
    const originalBuf = Buffer.from(await dlRes.arrayBuffer())
    const originalMB = (originalBuf.length / 1024 / 1024).toFixed(2)

    if (originalBuf.length < 9 * 1024 * 1024) {
      console.log(`  [skip] ${path} — already ${originalMB}MB, under 9MB`)
      skipped++
      continue
    }

    // 2. Backup
    if (!existsSync(backupPath)) {
      writeFileSync(backupPath, originalBuf)
    }

    // 3. Recompress
    const compressStart = Date.now()
    const compressedBuf = await sharp(originalBuf)
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()
    const compressedMB = (compressedBuf.length / 1024 / 1024).toFixed(2)

    // 4. Upload back (PUT overwrites)
    const upRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: compressedBuf,
    })
    if (!upRes.ok) {
      const errText = await upRes.text()
      console.log(`  [FAIL] ${path} — upload ${upRes.status}: ${errText.slice(0, 100)}`)
      failed++
      continue
    }

    const dlMs = compressStart - downloadStart
    const totalMs = Date.now() - downloadStart
    console.log(
      `  [ok] ${path}: ${originalMB}MB -> ${compressedMB}MB (dl ${dlMs}ms, total ${totalMs}ms)`,
    )
    processed++
  } catch (err) {
    console.log(`  [ERR] ${path}: ${err.message}`)
    failed++
  }
}

console.log(`\nDone. Processed: ${processed}  Skipped: ${skipped}  Failed: ${failed}`)
console.log(`Backups saved to: ${BACKUP_DIR}`)
