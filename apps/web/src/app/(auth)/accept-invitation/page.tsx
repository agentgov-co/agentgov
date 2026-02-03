'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { organization, useSession } from '@/lib/auth-client'
import { LogoLoader } from '@/components/logo'

function AcceptInvitationContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('id')
  const { data: session } = useSession()

  const [status, setStatus] = useState<'loading' | 'accepting' | 'success' | 'error' | 'login_required'>('loading')
  const [error, setError] = useState('')
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    const checkInvitation = async (): Promise<void> => {
      if (!invitationId) {
        setStatus('error')
        setError('Invalid invitation link')
        return
      }

      // Check if user is logged in
      if (!session?.user) {
        setStatus('login_required')
        return
      }

      // Try to accept the invitation
      setStatus('accepting')

      try {
        const { error: acceptError } = await organization.acceptInvitation({
          invitationId,
        })

        if (acceptError) {
          setStatus('error')
          setError(acceptError.message || 'Failed to accept invitation')
          return
        }

        // Get the organization name from the invitation response
        // The invitation data includes organizationId which we can use to fetch org details
        try {
          const { data: invData } = await organization.getInvitation({ query: { id: invitationId } })
          if (invData?.organizationId) {
            const { data: orgData } = await organization.getFullOrganization({
              query: { organizationId: invData.organizationId }
            })
            if (orgData) {
              setOrgName(orgData.name || 'the organization')
            }
          }
        } catch {
          // Ignore - we just won't have the org name
        }
        setStatus('success')

        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      } catch {
        setStatus('error')
        setError('An error occurred. Please try again.')
      }
    }

    checkInvitation()
  }, [invitationId, session, router])

  if (status === 'loading' || status === 'accepting') {
    return (
      <div className="bg-white rounded-3xl border border-black/10 p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {status === 'loading' ? 'Loading...' : 'Accepting invitation...'}
          </h1>
          <p className="text-black/60">
            Please wait while we process your request
          </p>
        </div>
      </div>
    )
  }

  if (status === 'login_required') {
    return (
      <div className="bg-white rounded-3xl border border-black/10 p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#7C3AED]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Sign in required
          </h1>
          <p className="text-black/60 mb-6">
            Please sign in or create an account to accept this invitation
          </p>
          <div className="space-y-3">
            <Link
              href={`/login?redirect=/accept-invitation?id=${invitationId}`}
              className="block w-full px-6 py-3 bg-[#7C3AED] text-white rounded-xl font-medium hover:bg-[#7C3AED]/90 transition-colors text-center"
            >
              Sign in
            </Link>
            <Link
              href={`/register?redirect=/accept-invitation?id=${invitationId}`}
              className="block w-full px-6 py-3 bg-white border border-black/10 rounded-xl font-medium hover:bg-black/5 transition-colors text-center"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="bg-white rounded-3xl border border-black/10 p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Welcome to {orgName}!
          </h1>
          <p className="text-black/60 mb-6">
            You have successfully joined the organization. Redirecting to dashboard...
          </p>
          <Link
            href="/dashboard"
            className="text-[#7C3AED] hover:underline font-medium"
          >
            Go to dashboard now
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="bg-white rounded-3xl border border-black/10 p-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Unable to accept invitation
        </h1>
        <p className="text-black/60 mb-6">
          {error || 'The invitation may have expired or already been used.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-[#7C3AED] text-white rounded-xl font-medium hover:bg-[#7C3AED]/90 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}

export default function AcceptInvitationPage(): React.JSX.Element {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-3xl border border-black/10 p-8">
        <div className="flex items-center justify-center py-8">
          <LogoLoader size={32} />
        </div>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}
