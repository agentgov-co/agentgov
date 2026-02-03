'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface LiveBadgeProps {
  isLive: boolean
  className?: string
}

export function LiveBadge({ isLive, className }: LiveBadgeProps): React.JSX.Element | null {
  if (!isLive) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-red-100 text-red-600',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      LIVE
    </span>
  )
}
