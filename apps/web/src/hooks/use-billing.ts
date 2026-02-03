'use client'

import { useMutation, useQuery, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { billingApi, type BillingStatus, type CheckoutSession, type PortalSession, type CreateCheckoutInput } from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'

export const billingKeys = {
  all: ['billing'] as const,
  status: () => [...billingKeys.all, 'status'] as const,
}

/**
 * Hook to check if billing is enabled
 */
export function useBillingStatus(): UseQueryResult<BillingStatus> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...billingKeys.status(), organization?.id],
    queryFn: () => billingApi.getStatus(),
    enabled: isAuthenticated && !!organization,
    staleTime: 5 * 60 * 1000, // 5 minutes - billing status rarely changes
  })
}

/**
 * Hook to create a checkout session for plan upgrade
 */
export function useCreateCheckout(): UseMutationResult<CheckoutSession, Error, CreateCheckoutInput> {
  return useMutation({
    mutationFn: (data: CreateCheckoutInput) => billingApi.createCheckout(data),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
  })
}

/**
 * Hook to create a billing portal session
 */
export function useCreatePortal(): UseMutationResult<PortalSession, Error, string> {
  return useMutation({
    mutationFn: (returnUrl: string) => billingApi.createPortal({ returnUrl }),
    onSuccess: (data) => {
      // Redirect to Stripe portal
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      }
    },
  })
}

/**
 * Helper to get upgrade URL parameters
 */
export function getUpgradeUrls(): { successUrl: string; cancelUrl: string; returnUrl: string } {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    successUrl: `${baseUrl}/dashboard/settings?tab=usage&upgrade=success`,
    cancelUrl: `${baseUrl}/dashboard/settings?tab=usage&upgrade=cancelled`,
    returnUrl: `${baseUrl}/dashboard/settings?tab=usage`,
  }
}
