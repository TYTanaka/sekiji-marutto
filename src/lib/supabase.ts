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
  /** 席次が決まっている場合のお席（未配置なら null / 旧RPCでは未定義） */
  seat?: { tableName: string; seatIndex: number } | null
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

/**
 * 自分の式の招待リンク開封記録（token → ISO日時）を取得する。
 * マイグレーション未適用などでテーブルが無い場合は空を返し、機能ごと無効化される。
 */
export async function fetchOpens(
  weddingId: string,
): Promise<Record<string, string>> {
  if (!supabase) return {}

  try {
    const { data, error } = await supabase
      .from('invitation_opens')
      .select('token,opened_at')
      .eq('wedding_id', weddingId)

    if (error || !data) return {}

    const opens: Record<string, string> = {}
    for (const row of data as { token: string; opened_at: string }[]) {
      opens[row.token] = row.opened_at
    }
    return opens
  } catch {
    return {}
  }
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
