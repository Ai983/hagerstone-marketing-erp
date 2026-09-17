/**
 * Timeline entries a person logged by hand, which can be edited, moved to
 * another lead or deleted — by their author or an Admin. System entries
 * (stage changes, lead created, campaign sends, WhatsApp traffic) cannot.
 */
export const EDITABLE_INTERACTION_TYPES = new Set([
  "note", "call_outbound", "call_inbound", "call_missed", "meeting", "site_visit",
])

export function canChangeInteraction(
  interaction: { type: string; user_id?: string | null; is_automated?: boolean | null },
  me: { id?: string | null; role?: string | null }
) {
  if (!EDITABLE_INTERACTION_TYPES.has(interaction.type) || interaction.is_automated) return false
  return Boolean(me.id) && (interaction.user_id === me.id || me.role === "admin")
}
