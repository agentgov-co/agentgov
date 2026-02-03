'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { usageApi, type UsageData } from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'

export const usageKeys = {
  all: ['usage'] as const,
  current: () => [...usageKeys.all, 'current'] as const,
}

/**
 * Hook to fetch current usage and limits for the organization
 * Refetches every 30 seconds to keep dashboard up to date
 */
export function useUsage(): UseQueryResult<UsageData> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...usageKeys.current(), organization?.id],
    queryFn: () => usageApi.get(),
    enabled: isAuthenticated && !!organization,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}

/**
 * Helper to check if usage is at or above a threshold percentage
 */
export function isAtLimit(percentage: number, threshold: number = 100): boolean {
  return percentage >= threshold
}

/**
 * Helper to check if usage is approaching limit (>= 80%)
 */
export function isApproachingLimit(percentage: number): boolean {
  return percentage >= 80 && percentage < 100
}

/**
 * Helper to format limit display (-1 means unlimited)
 */
export function formatLimit(limit: number): string {
  if (limit === -1) return 'Unlimited'
  return limit.toLocaleString()
}
