import * as React from 'react'

import { cn } from '@/lib/utils'

export type TraceStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

const statusConfig: Record<TraceStatus, { dot: string; text: string; label: string }> = {
  RUNNING: { dot: 'bg-violet-500', text: 'text-violet-600', label: 'Running' },
  COMPLETED: { dot: 'bg-green-500', text: 'text-green-600', label: 'Completed' },
  FAILED: { dot: 'bg-red-500', text: 'text-red-600', label: 'Failed' },
  CANCELLED: { dot: 'bg-gray-400', text: 'text-gray-600', label: 'Cancelled' },
}

interface StatusBadgeProps {
  status: TraceStatus
  showLabel?: boolean
  className?: string
}

export function StatusBadge({ status, showLabel = true, className }: StatusBadgeProps): React.JSX.Element {
  const config = statusConfig[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', config.dot)} />
      {showLabel && (
        <span className={cn('text-sm font-medium', config.text)}>
          {config.label}
        </span>
      )}
    </span>
  )
}

export { statusConfig }
