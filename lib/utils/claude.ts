// Shared helper for calling Claude API from server routes.
//
// Centralizes: model id, endpoint, headers, JSON extraction, and
// a uniform error shape so every AI route has the same behavior.

export const CLAUDE_MODEL = "claude-sonnet-4-20250514"

export interface ClaudeCallOptions {
  system: string
  userMessage: string
  maxTokens?: number
  temperature?: number
}

export interface ClaudeCallResult<T> {
  data: T
  rawText: string
}

export class ClaudeError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
    this.name = "ClaudeError"
  }
}

/**
 * Calls Claude and parses the first text block as strict JSON.
 * Handles three common "return JSON" failure modes:
 *  - Claude wraps the JSON in ```json ... ``` markdown
 *  - Claude adds prose before/after the JSON
 *  - Claude returns an object where we expected an array (or vice versa)
 */
export async function callClaudeJSON<T>(options: ClaudeCallOptions): Promise<ClaudeCallResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ClaudeError("ANTHROPIC_API_KEY is not configured", 503)
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? 1000,
      temperature: options.temperature ?? 0.4,
      system: options.system,
      messages: [{ role: "user", content: options.userMessage }],
    }),
  })

  const raw = await res.json().catch(() => null)

  if (!res.ok) {
    const message = raw?.error?.message || `Anthropic API returned ${res.status}`
    throw new ClaudeError(message, res.status)
  }

  const text: string = raw?.content?.[0]?.text ?? ""
  if (!text) {
    throw new ClaudeError("Claude returned an empty response", 502)
  }

  const parsed = tryParseJSON<T>(text)
  if (!parsed) {
    throw new ClaudeError("Claude response was not valid JSON", 502)
  }

  return { data: parsed, rawText: text }
}

function tryParseJSON<T>(text: string): T | null {
  const trimmed = text.trim()

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  try {
    return JSON.parse(candidate) as T
  } catch {
    // Last resort: find the first { ... } block and try that
    const firstBrace = candidate.indexOf("{")
    const lastBrace = candidate.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}
