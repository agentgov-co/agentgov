'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, XCircle } from 'lucide-react'
import { useUsage, isAtLimit, isApproachingLimit } from '@/hooks/use-usage'
import { cn } from '@/lib/utils'

/**
 * Usage warning banner displayed in dashboard header
 * Shows warning at 80% usage, error at 100%
 */
export function UsageWarning(): React.JSX.Element | null {
  const { data: usage, isLoading } = useUsage()

  // Don't show anything while loading or if no data
  if (isLoading || !usage) {
    return null
  }

  // Check if at limit (100%)
  const atLimit = isAtLimit(usage.tracesPercentage)

  // Check if approaching limit (80-99%)
  const approaching = isApproachingLimit(usage.tracesPercentage)

  // Don't show banner if usage is fine
  if (!atLimit && !approaching) {
    return null
  }

  return (
    <div
      className={cn(
        'w-full px-4 py-2 text-sm flex items-center justify-center gap-2',
        atLimit
          ? 'bg-red-50 text-red-700 border-b border-red-200'
          : 'bg-amber-50 text-amber-700 border-b border-amber-200'
      )}
    >
      {atLimit ? (
        <XCircle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      )}
      <span>
        {atLimit ? (
          <>
            You&apos;ve reached your monthly trace limit ({usage.tracesLimit.toLocaleString()} traces).
            New traces will be rejected.
          </>
        ) : (
          <>
            You&apos;ve used {usage.tracesPercentage}% of your monthly trace limit
            ({usage.tracesCount.toLocaleString()} / {usage.tracesLimit.toLocaleString()}).
          </>
        )}
      </span>
      <Link
        href="/dashboard/settings?tab=usage"
        className={cn(
          'font-medium underline underline-offset-2',
          atLimit ? 'hover:text-red-800' : 'hover:text-amber-800'
        )}
      >
        {usage.billingEnabled ? 'Upgrade plan' : 'View usage'}
      </Link>
    </div>
  )
}
