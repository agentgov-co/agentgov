'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { twoFactor } from '@/lib/auth-client'

export default function TwoFactorPage(): React.JSX.Element {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('Please enter a code')
      return
    }

    setIsLoading(true)

    try {
      if (useBackupCode) {
        // Verify with backup code
        const { error: verifyError } = await twoFactor.verifyBackupCode({
          code: code.trim(),
        })

        if (verifyError) {
          setError(verifyError.message || 'Invalid backup code')
          setIsLoading(false)
          return
        }
      } else {
        // Verify with TOTP
        const { error: verifyError } = await twoFactor.verifyTotp({
          code: code.trim(),
          trustDevice: true,
        })

        if (verifyError) {
          setError(verifyError.message || 'Invalid code. Please try again.')
          setIsLoading(false)
          return
        }
      }

      router.push('/dashboard')
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-black/10 p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-[#7C3AED]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Two-Factor Authentication
        </h1>
        <p className="text-black/60">
          {useBackupCode
            ? 'Enter one of your backup codes'
            : 'Enter the code from your authenticator app'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="code" className="block text-sm font-medium">
            {useBackupCode ? 'Backup Code' : 'Authentication Code'}
          </label>
          <input
            id="code"
            type="text"
            inputMode={useBackupCode ? 'text' : 'numeric'}
            pattern={useBackupCode ? undefined : '[0-9]*'}
            maxLength={useBackupCode ? 20 : 6}
            placeholder={useBackupCode ? 'Enter backup code' : '000000'}
            value={code}
            onChange={(e) => setCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            className={`w-full px-4 py-3 bg-[#F5F5F5] border border-transparent rounded-xl focus:border-[#7C3AED] focus:outline-none transition-colors ${
              !useBackupCode ? 'text-center text-2xl tracking-widest font-mono' : ''
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full px-6 py-3 bg-[#7C3AED] text-white rounded-xl font-medium hover:bg-[#7C3AED]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {/* Toggle backup code */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode)
            setCode('')
            setError('')
          }}
          className="text-sm text-[#7C3AED] hover:underline"
        >
          {useBackupCode
            ? 'Use authenticator app instead'
            : 'Use a backup code instead'}
        </button>
      </div>

      {/* Back to login */}
      <p className="mt-6 text-center text-sm text-black/60">
        <Link href="/login" className="text-[#7C3AED] hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
