"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

// ── Module-level cache ──────────────────────────────────────────────
//
// We cache both the user and their profile in module scope so every
// component sharing this module gets the same instance. The supabase
// client uses a browser-wide lock on the auth-token storage key
// ("sb-…-auth-token"); when many components call getUser() at once
// (which happens as soon as a dashboard page mounts) they race for
// that lock and one of them sees:
//   "Lock … was released because another request stole it"
//
// De-duping the actual network call here fixes the race at source.

let cachedUser: User | null = null
// Profile is intentionally untyped here — each caller casts to its own
// narrower Profile shape. This avoids a circular import with lib/types.
let cachedProfile: Record<string, unknown> | null = null
let inFlight: Promise<{ user: User | null; profile: Record<string, unknown> | null }> | null = null
let listenerRegistered = false

async function fetchFresh(): Promise<{
  user: User | null
  profile: Record<string, unknown> | null
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  return { user, profile: (profile as Record<string, unknown> | null) ?? null }
}

function resolveCachedOrFetch() {
  if (cachedUser) {
    return Promise.resolve({ user: cachedUser, profile: cachedProfile })
  }
  if (inFlight) return inFlight

  inFlight = fetchFresh()
    .then((result) => {
      cachedUser = result.user
      cachedProfile = result.profile
      inFlight = null
      return result
    })
    .catch((err) => {
      inFlight = null
      throw err
    })
  return inFlight
}

function registerAuthListenerOnce() {
  if (listenerRegistered) return
  listenerRegistered = true
  const supabase = createClient()
  // When auth state changes, blow away the cache so the next caller
  // gets a fresh user + profile. We don't pre-fetch — lazy is fine.
  supabase.auth.onAuthStateChange((event) => {
    if (
      event === "SIGNED_OUT" ||
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      cachedUser = null
      cachedProfile = null
      inFlight = null
    }
  })
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Resolve the current user outside the React tree. Useful inside
 * React Query queryFns, submit handlers, and background async work
 * where a hook isn't available. Returns `null` when signed out.
 */
export async function getCachedUser(): Promise<User | null> {
  registerAuthListenerOnce()
  const { user } = await resolveCachedOrFetch()
  return user
}

/**
 * Same as `getCachedUser` but also returns the profile row. Returns
 * `{ user: null, profile: null }` when signed out.
 */
export async function getCachedUserAndProfile(): Promise<{
  user: User | null
  profile: Record<string, unknown> | null
}> {
  registerAuthListenerOnce()
  return resolveCachedOrFetch()
}

/**
 * Reactive hook. Returns cached values instantly when available, then
 * kicks off a single shared fetch on first mount. Re-renders across
 * the tree when auth state changes.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(cachedProfile)
  const [loading, setLoading] = useState<boolean>(!cachedUser)

  useEffect(() => {
    registerAuthListenerOnce()

    // If another component already populated the cache, we're done.
    if (cachedUser) {
      setUser(cachedUser)
      setProfile(cachedProfile)
      setLoading(false)
      return
    }

    let cancelled = false
    resolveCachedOrFetch()
      .then(({ user, profile }) => {
        if (cancelled) return
        setUser(user)
        setProfile(profile)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { user, profile, loading }
}
