'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // SIGN UP FUNCTION
  const handleSignUp = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Check your email for confirmation!')
    }

    setLoading(false)
  }

  // LOGIN FUNCTION
  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-center">
          Login / Sign Up
        </h1>

        {error && (
          <p className="mb-4 text-red-500 text-sm">{error}</p>
        )}

        <input
  type="email"
  placeholder="Enter your email"
  className="mb-3 w-full rounded border border-gray-300 bg-white p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

<input
  type="password"
  placeholder="Enter your password"
  className="mb-4 w-full rounded border border-gray-300 bg-white p-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="mb-3 w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
        >
          {loading ? 'Loading...' : 'Login'}
        </button>

        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full rounded bg-gray-800 p-2 text-white hover:bg-gray-900"
        >
          Sign Up
        </button>
      </div>
    </div>
  )
}