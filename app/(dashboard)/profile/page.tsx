"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  Shield,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

// ── Helpers ─────────────────────────────────────────────────────────

const roleMeta: Record<
  UserRole,
  { label: string; color: string; bg: string }
> = {
  admin: { label: "Admin", color: "#F87171", bg: "#F8717120" },
  manager: { label: "Manager", color: "#C084FC", bg: "#C084FC20" },
  founder: { label: "Founder", color: "#F59E0B", bg: "#F59E0B20" },
  marketing: { label: "Marketing", color: "#60A5FA", bg: "#60A5FA20" },
  sales_rep: { label: "Sales Rep", color: "#34D399", bg: "#34D39920" },
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

type PasswordStrength = "weak" | "fair" | "good" | "strong"

function getStrength(pw: string): {
  level: PasswordStrength
  score: number
  label: string
  color: string
} {
  let score = 0
  if (pw.length >= 8) score += 1
  if (pw.length >= 12) score += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw)) score += 1

  if (pw.length === 0) {
    return { level: "weak", score: 0, label: "", color: "#2A2A3C" }
  }
  if (score <= 1) return { level: "weak", score, label: "Weak", color: "#F87171" }
  if (score === 2) return { level: "fair", score, label: "Fair", color: "#F59E0B" }
  if (score === 3) return { level: "good", score, label: "Good", color: "#60A5FA" }
  return { level: "strong", score, label: "Strong", color: "#34D399" }
}

interface ProfileData {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string
}

// ── Page ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [authEmail, setAuthEmail] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  // Personal info state
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [savingPersonal, setSavingPersonal] = useState(false)

  // Password state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { user, profile: p } = await getCachedUserAndProfile()
      if (!mounted) return
      if (!user || !p) {
        router.replace("/login")
        return
      }
      // The cached profile may not include created_at — pull it fresh.
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .eq("id", user.id)
        .maybeSingle()
      if (!mounted) return
      const row = (data ?? p) as ProfileData
      setProfile(row)
      // Display auth session email, not profiles.email. The profiles
      // row can drift (mid-email-change, manual edits), but auth.users
      // is the source of truth for the address the user signs in with.
      setAuthEmail(user.email ?? "")
      setFullName(row.full_name ?? "")
      setPhone(row.phone ?? "")
      setIsLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [router])

  const strength = useMemo(() => getStrength(newPassword), [newPassword])
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword

  // ── Save handlers ─────────────────────────────────────────────────

  const handleSavePersonal = async () => {
    if (!profile) return
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty")
      return
    }
    setSavingPersonal(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq("id", profile.id)
      if (error) throw error
      setProfile({
        ...profile,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      })
      toast.success("Profile updated successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setSavingPersonal(false)
    }
  }

  const handleSavePassword = async () => {
    if (!profile) return
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    // NOTE: the Current Password field is collected for familiar UX but
    // we no longer re-authenticate against it. Supabase's updateUser
    // rotates the password on the active session; anyone holding this
    // session can change it. Keep this in mind as a security tradeoff.

    setSavingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) {
        toast.error(error.message)
        return
      }

      toast.success("Password changed successfully!")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setSavingPassword(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  if (isLoading || !profile) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  const role = roleMeta[profile.role]
  const personalDirty =
    fullName.trim() !== profile.full_name ||
    (phone.trim() || "") !== (profile.phone ?? "")

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
            style={{ backgroundColor: role.bg, color: role.color }}
          >
            {getInitials(profile.full_name)}
          </div>
          <div className="flex-1">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              My Profile
            </h1>
            <p className="text-sm text-[#9090A8]">
              Manage your personal information
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: role.bg, color: role.color }}
          >
            <Shield className="size-3" />
            {role.label}
          </span>
        </div>

        {/* Two-column grid on lg+ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* ── Personal Info card ──────────────────────────────── */}
          <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserIcon className="size-4 text-[#9090A8]" />
              <h2 className="text-sm font-semibold text-[#F0F0FA]">
                Personal Information
              </h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="fullName"
                  className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="phone"
                  className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                  Email Address
                </label>
                <p className="font-mono text-sm text-[#9090A8]">{authEmail}</p>
                <p className="text-[11px] text-[#5A5A72]">
                  Contact admin to change your email address
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                  Role
                </label>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: role.bg, color: role.color }}
                  >
                    <Shield className="size-3" />
                    {role.label}
                  </span>
                  <p className="mt-1.5 text-[11px] text-[#5A5A72]">
                    Your role can only be changed by an admin.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                  Member Since
                </label>
                <p className="text-sm text-[#F0F0FA]">
                  {format(new Date(profile.created_at), "MMMM d, yyyy")}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSavePersonal}
                  disabled={savingPersonal || !personalDirty}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPersonal ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Save className="size-3" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </section>

          {/* ── Password card ───────────────────────────────── */}
          <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="size-4 text-[#9090A8]" />
              <h2 className="text-sm font-semibold text-[#F0F0FA]">
                Change Password
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                  <PasswordField
                    id="newPassword"
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  {/* Strength bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1 flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full transition-colors"
                          style={{
                            backgroundColor:
                              newPassword.length > 0 && i < strength.score
                                ? strength.color
                                : "#2A2A3C",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="w-12 text-right text-[11px] font-medium"
                      style={{ color: strength.color }}
                    >
                      {strength.label}
                    </span>
                  </div>
                </div>

                <div>
                  <PasswordField
                    id="confirmNewPassword"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    error={passwordsMismatch}
                  />
                  {passwordsMismatch && (
                    <p className="mt-1 text-[11px] text-[#F87171]">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePassword}
                    disabled={
                      savingPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      passwordsMismatch
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPassword ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    Save Password
                  </button>
                </div>
              </div>
            </section>
        </div>
      </div>
    </main>
  )
}

// ── Shared password input with eye toggle ──────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  placeholder,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  show: boolean
  onToggle: () => void
  autoComplete: string
  placeholder?: string
  error?: boolean
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={cn(
            "h-10 w-full rounded-lg border bg-[#1F1F2E] pl-3 pr-11 text-sm text-[#F0F0FA] outline-none transition focus:ring-2",
            error
              ? "border-[#F87171] focus:border-[#F87171] focus:ring-[#F87171]/20"
              : "border-[#3A3A52] focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1.5 text-[#9090A8] transition hover:text-[#F0F0FA]"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
