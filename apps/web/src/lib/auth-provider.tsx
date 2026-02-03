'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useSession, type Session, type User, organization, signOut as authSignOut } from './auth-client'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isOrgLoading: boolean
  isAuthenticated: boolean
  organization: {
    id: string
    name: string
    slug: string
    role: string
  } | null
  signOut: () => Promise<void>
  refreshSession: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { data: sessionData, isPending, refetch } = useSession()
  const [activeOrg, setActiveOrg] = useState<AuthContextType['organization']>(null)
  const [isOrgLoading, setIsOrgLoading] = useState(true)

  // Fetch active organization when session changes
  useEffect(() => {
    let cancelled = false

    const fetchOrg = async (): Promise<void> => {
      if (sessionData?.session?.activeOrganizationId) {
        setIsOrgLoading(true)
        try {
          const { data } = await organization.getFullOrganization({
            query: { organizationId: sessionData.session.activeOrganizationId }
          })
          if (!cancelled && data) {
            const member = data.members?.find(m => m.userId === sessionData.user.id)
            setActiveOrg({
              id: data.id,
              name: data.name,
              slug: data.slug,
              role: member?.role || 'member',
            })
          }
        } catch {
          if (!cancelled) setActiveOrg(null)
        } finally {
          if (!cancelled) setIsOrgLoading(false)
        }
      } else if (!cancelled) {
        setActiveOrg(null)
        setIsOrgLoading(false)
      }
    }

    fetchOrg()

    return () => {
      cancelled = true
    }
  }, [sessionData?.session?.activeOrganizationId, sessionData?.user?.id])

  const handleSignOut = useCallback(async () => {
    await authSignOut()
    setActiveOrg(null)
  }, [])

  const value: AuthContextType = {
    user: sessionData?.user ?? null,
    session: sessionData ?? null,
    isLoading: isPending,
    isOrgLoading,
    isAuthenticated: !!sessionData?.user,
    organization: activeOrg,
    signOut: handleSignOut,
    refreshSession: refetch,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
