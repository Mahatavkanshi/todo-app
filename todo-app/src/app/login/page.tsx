'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const recoverLocalSession = async () => {
      try {
        const { error } = await supabase.auth.getSession()
        if (error && /fetch/i.test(error.message)) {
          await supabase.auth.signOut({ scope: 'local' })
        }
      } catch {
        await supabase.auth.signOut({ scope: 'local' })
      }
    }

    recoverLocalSession()
  }, [])

  // SIGN UP FUNCTION
  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        setNotice('Account created. Check your email for confirmation before logging in.')
      }
    } catch {
      setError('Unable to reach Supabase. Check internet/VPN/firewall and try again.')
    }

    setLoading(false)
  }

  // LOGIN FUNCTION
  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Unable to reach Supabase. Check internet/VPN/firewall and try again.')
    }

    setLoading(false)
  }

  return (
    <div className="app-shell flex items-center justify-center">
      <div className="glass-panel glass-panel-strong fade-up w-full max-w-4xl overflow-hidden md:grid md:grid-cols-[1.08fr_1fr]">
        <div className="hidden bg-linear-to-br from-teal-700 via-cyan-700 to-sky-700 p-8 text-teal-50 md:block">
          <p className="text-xs uppercase tracking-[0.24em] text-teal-100/80">Todo Workspace</p>
          <h1 className="mt-3 text-4xl leading-tight">Plan less. Ship more.</h1>
          <p className="mt-4 max-w-sm text-sm text-teal-100/90">
            Keep your daily tasks in one place with secure sign-in and a clear flow from capture to completion.
          </p>
          <div className="mt-8 rounded-xl border border-teal-100/30 bg-teal-950/25 p-4 text-sm">
            <p className="font-semibold">Quick routine</p>
            <p className="mt-1 text-teal-100/85">Sign in, add your top 3 tasks, and clear the queue before lunch.</p>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Welcome</p>
          <h2 className="mt-2 text-3xl leading-tight">Login / Sign Up</h2>
          <p className="mt-2 text-sm text-slate-600">Use your email to access your personal task dashboard.</p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {notice && (
            <p className="surface-note mt-3 stagger-pop">{notice}</p>
          )}

          <div className="mt-5 space-y-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="soft-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Enter your password"
              className="soft-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>

            <button
              onClick={handleSignUp}
              disabled={loading}
              className="btn btn-secondary"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}