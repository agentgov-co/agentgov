'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'icon' | 'wordmark' | 'full'
}

const sizes = {
  sm: { icon: 20, text: 'text-base' },
  md: { icon: 24, text: 'text-lg' },
  lg: { icon: 32, text: 'text-xl' },
}

export function Logo({ className, size = 'md', variant = 'full' }: LogoProps): React.JSX.Element {
  const s = sizes[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {(variant === 'icon' || variant === 'full') && (
        <LogoIcon size={s.icon} />
      )}
      {(variant === 'wordmark' || variant === 'full') && (
        <span className={cn('font-semibold tracking-tight', s.text)}>
          AgentGov
        </span>
      )}
    </div>
  )
}

interface LogoIconProps {
  size?: number
  className?: string
}

export function LogoIcon({ size = 24, className }: LogoIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Trace Flow: три соединённых узла */}
      <circle cx="6" cy="16" r="4" fill="#7C3AED" />
      <circle cx="16" cy="6" r="4" fill="#7C3AED" />
      <circle cx="26" cy="20" r="4" fill="#7C3AED" />

      {/* Connecting lines */}
      <path
        d="M9.5 13.5L13 9M19 8L23 17"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Small accent dot */}
      <circle cx="16" cy="26" r="2.5" fill="#7C3AED" opacity="0.4" />
      <path
        d="M14.5 24L8.5 18.5"
        stroke="#7C3AED"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  )
}

export function LogoLoader({ size = 32, className }: LogoIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        @keyframes pulse1 { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes pulse2 { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulse3 { 0%, 33% { opacity: 0.3; } 66%, 100% { opacity: 1; } }
        @keyframes dash { 0% { stroke-dashoffset: 20; } 100% { stroke-dashoffset: 0; } }
        .node1 { animation: pulse1 1.2s ease-in-out infinite; }
        .node2 { animation: pulse2 1.2s ease-in-out infinite; }
        .node3 { animation: pulse3 1.2s ease-in-out infinite; }
        .line { stroke-dasharray: 10; animation: dash 1.2s linear infinite; }
      `}</style>

      <circle cx="6" cy="16" r="4" fill="#7C3AED" className="node1" />
      <circle cx="16" cy="6" r="4" fill="#7C3AED" className="node2" />
      <circle cx="26" cy="20" r="4" fill="#7C3AED" className="node3" />

      <path
        d="M9.5 13.5L13 9M19 8L23 17"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="line"
      />
    </svg>
  )
}
