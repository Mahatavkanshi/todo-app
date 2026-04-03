import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const createSupabaseBrowserClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  })

declare global {
  var __todoAppSupabaseClient: ReturnType<typeof createSupabaseBrowserClient> | undefined
}

export const supabase =
  globalThis.__todoAppSupabaseClient ?? createSupabaseBrowserClient()

if (typeof window !== 'undefined') {
  globalThis.__todoAppSupabaseClient = supabase
}