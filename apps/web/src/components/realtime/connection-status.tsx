'use client'

import React from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { ConnectionStatus as ConnectionStatusType } from '@/hooks/use-realtime'

interface ConnectionStatusProps {
  status: ConnectionStatusType
  className?: string
}

const statusConfig = {
  connecting: {
    icon: Loader2,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    label: 'Connecting...',
    animate: 'animate-spin'
  },
  connected: {
    icon: Wifi,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Live',
    animate: ''
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Disconnected',
    animate: ''
  },
  closing: {
    icon: Loader2,
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    label: 'Closing...',
    animate: 'animate-spin'
  },
  uninstantiated: {
    icon: WifiOff,
    color: 'text-black/40',
    bgColor: 'bg-black/5',
    label: 'Not started',
    animate: ''
  }
}

export function ConnectionStatus({ status, className }: ConnectionStatusProps): React.JSX.Element {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              config.bgColor,
              config.color,
              className
            )}
          >
            <Icon className={cn('h-3 w-3', config.animate)} />
            <span>{status === 'connected' ? 'Live' : config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>WebSocket: {config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
