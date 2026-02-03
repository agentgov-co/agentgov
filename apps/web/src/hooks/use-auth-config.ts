import { useQuery, type UseQueryResult } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AuthConfig {
  providers: {
    google: boolean
    github: boolean
  }
  features: {
    emailPassword: boolean
    twoFactor: boolean
    organizations: boolean
  }
}

async function fetchAuthConfig(): Promise<AuthConfig> {
  const response = await fetch(`${API_URL}/v1/auth/config`)
  if (!response.ok) {
    throw new Error('Failed to fetch auth config')
  }
  return response.json()
}

export function useAuthConfig(): UseQueryResult<AuthConfig> {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: fetchAuthConfig,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  })
}
