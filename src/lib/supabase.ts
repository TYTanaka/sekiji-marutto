import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled: boolean = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!)
  : null

export interface InvitationData {
  info: {
    groomName: string
    brideName: string
    date: string
    venue: string
    message: string
  }
  guest: {
    id: string
    name: string
    title: string
    rsvp: string
    companions: number
    allergy: string
    memo: string
  }
}

export async function fetchInvitation(
  token: string,
): Promise<InvitationData | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_invitation', {
    p_token: token,
  })

  if (error || data == null) return null

  return data as InvitationData
}

export async function submitRsvpCloud(
  token: string,
  rsvp: 'attending' | 'declined',
  companions: number,
  allergy: string,
  memo: string,
): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase.rpc('submit_rsvp', {
    p_token: token,
    p_rsvp: rsvp,
    p_companions: companions,
    p_allergy: allergy,
    p_memo: memo,
  })

  return !error && data === true
}

export function newInviteToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let token = 'inv-'

  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const values = new Uint32Array(10)
    globalThis.crypto.getRandomValues(values)

    for (const value of values) {
      token += alphabet.charAt(value % alphabet.length)
    }
  } else {
    for (let i = 0; i < 10; i += 1) {
      token += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
  }

  return token
}
