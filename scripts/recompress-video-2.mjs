#!/usr/bin/env node
// One-off: compress already-downloaded /tmp/test-2.mp4 and upload to Supabase.

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import ffmpegPath from "ffmpeg-static"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const envText = readFileSync(resolve(ROOT, ".env.local"), "utf8")
const env = Object.fromEntries(
  envText.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=")
    return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]
  })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const BACKUP_DIR = resolve(ROOT, "portfolio-originals-backup")
mkdirSync(BACKUP_DIR, { recursive: true })

const LOCAL_SOURCE = resolve(ROOT, ".tmp-video-2.mp4")
const TARGET_PATH = "hero-videos/2.mp4"
const tmpOutput = resolve(ROOT, ".tmp-out-2.mp4")
const backupPath = resolve(BACKUP_DIR, "hero-videos_2.mp4")

console.log(`Reading ${LOCAL_SOURCE}`)
const buf = readFileSync(LOCAL_SOURCE)
console.log(`Size: ${(buf.length / 1024 / 1024).toFixed(2)} MB`)

if (!existsSync(backupPath)) {
  writeFileSync(backupPath, buf)
  console.log("Backup saved")
}

console.log("Compressing...")
const result = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-i", LOCAL_SOURCE,
    "-vf", "scale='min(1920,iw)':-2",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    tmpOutput,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
)
if (result.status !== 0) {
  console.error("ffmpeg failed:", result.stderr?.toString().slice(-500))
  process.exit(1)
}
const compressed = readFileSync(tmpOutput)
console.log(`Compressed: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`)

const uploadUrl = `${SUPABASE_URL}/storage/v1/object/portfolio/${TARGET_PATH}`
console.log("Uploading...")
const upRes = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    "Content-Type": "video/mp4",
    "x-upsert": "true",
  },
  body: compressed,
})
if (!upRes.ok) {
  console.error("Upload failed:", upRes.status, await upRes.text())
  process.exit(1)
}
console.log("✓ uploaded")
unlinkSync(tmpOutput)
