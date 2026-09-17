"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2, LogOut } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

/**
 * Where a signed-in account lands while it has no access: a new sign-up
 * waiting for an Admin, or a user an Admin has deactivated.
 */
export default function PendingApprovalPage() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await createClient().auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A3C] bg-[#111118] p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#F59E0B]/15">
          <Clock className="size-6 text-[#F59E0B]" />
        </div>
        <h1 className="text-xl font-semibold text-[#F0F0FA]">Waiting for admin approval</h1>
        <p className="mt-2 text-sm leading-6 text-[#9090A8]">
          Your account is set up, but an Admin has to turn on access before you can use Hagerstone ERP.
          Ask the admin to activate you under Admin → Users, then sign in again.
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#2A2A3C] text-sm text-[#F0F0FA] hover:bg-[#1A1A24] disabled:opacity-50"
        >
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Sign out
        </button>
      </div>
    </main>
  )
}
