'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '@/hooks/use-mobile'
import type { Span, SpanType, SpanStatus } from '@/lib/api'
import {
  Bot,
  Wrench,
  Database,
  Sparkles,
  Code,
  ChevronRight,
} from 'lucide-react'

const typeConfig: Record<SpanType, {
  icon: typeof Bot
  label: string
  color: string
  bgColor: string
  barColor: string
}> = {
  LLM_CALL: {
    icon: Bot,
    label: 'LLM',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    barColor: 'bg-purple-500'
  },
  TOOL_CALL: {
    icon: Wrench,
    label: 'Tool',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    barColor: 'bg-blue-500'
  },
  AGENT_STEP: {
    icon: Sparkles,
    label: 'Agent',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    barColor: 'bg-amber-500'
  },
  RETRIEVAL: {
    icon: Database,
    label: 'Retrieval',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    barColor: 'bg-green-500'
  },
  EMBEDDING: {
    icon: Database,
    label: 'Embed',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    barColor: 'bg-teal-500'
  },
  CUSTOM: {
    icon: Code,
    label: 'Custom',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    barColor: 'bg-gray-500'
  },
}

const statusConfig: Record<SpanStatus, { dot: string; text: string; label: string }> = {
  RUNNING: { dot: 'bg-violet-500 animate-pulse', text: 'text-violet-600', label: 'Running' },
  COMPLETED: { dot: 'bg-green-500', text: 'text-green-600', label: 'Done' },
  FAILED: { dot: 'bg-red-500', text: 'text-red-600', label: 'Error' },
}

interface TraceTimelineProps {
  spans: Span[]
  selectedSpanId: string | null
  onSelectSpan: (span: Span) => void
  traceStartTime: number
  traceDuration: number
}

interface FlattenedSpan extends Span {
  depth: number
}

export function TraceTimeline({
  spans,
  selectedSpanId,
  onSelectSpan,
  traceStartTime,
  traceDuration
}: TraceTimelineProps): React.JSX.Element {
  const isDesktop = useIsDesktop()
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Update current time for running spans
  useEffect(() => {
    const hasRunning = spans.some(s => s.status === 'RUNNING')
    if (!hasRunning) return

    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [spans])

  // Flatten spans with depth for rendering
  const flatSpans = useMemo(() => {
    const result: FlattenedSpan[] = []
    const rootSpans = spans.filter(s => !s.parentId)

    function addSpan(span: Span, depth: number): void {
      result.push({ ...span, depth })
      const children = spans.filter(s => s.parentId === span.id)
      children.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      children.forEach(child => addSpan(child, depth + 1))
    }

    rootSpans.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    rootSpans.forEach(span => addSpan(span, 0))

    return result
  }, [spans])

  if (flatSpans.length === 0) {
    return <p className="text-black/50 text-center py-8">No spans recorded</p>
  }

  const effectiveDuration = traceDuration || 1000

  // Desktop: Gantt chart style timeline
  if (isDesktop) {
    return (
      <div className="space-y-0 overflow-hidden">
        {/* Timeline header with time markers */}
        <div className="flex items-center h-8 border-b border-black/10 mb-2">
          <div className="w-52 shrink-0" />
          <div className="flex-1 relative h-full overflow-hidden">
            <TimeMarkers duration={effectiveDuration} />
          </div>
          <div className="w-28 shrink-0" />
        </div>

        {/* Spans */}
        <div className="space-y-0.5">
          {flatSpans.map((span) => (
            <DesktopTimelineRow
              key={span.id}
              span={span}
              isSelected={span.id === selectedSpanId}
              onSelect={() => onSelectSpan(span)}
              traceStartTime={traceStartTime}
              traceDuration={effectiveDuration}
              currentTime={currentTime}
            />
          ))}
        </div>
      </div>
    )
  }

  // Mobile: Card-style list
  return (
    <div className="space-y-1">
      {flatSpans.map((span) => (
        <MobileTimelineRow
          key={span.id}
          span={span}
          isSelected={span.id === selectedSpanId}
          onSelect={() => onSelectSpan(span)}
          currentTime={currentTime}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Mobile Timeline Row
// ============================================================================

interface MobileTimelineRowProps {
  span: FlattenedSpan
  isSelected: boolean
  onSelect: () => void
  currentTime: number
}

function MobileTimelineRow({ span, isSelected, onSelect, currentTime }: MobileTimelineRowProps): React.JSX.Element {
  const config = typeConfig[span.type] || typeConfig.CUSTOM
  const status = statusConfig[span.status]
  const Icon = config.icon

  const spanStart = new Date(span.startedAt).getTime()
  const spanDuration = span.duration || (span.status === 'RUNNING' ? currentTime - spanStart : 0)

  return (
    <button
      type="button"
      className={cn(
        // Base styles - touch-friendly height (min 44px)
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl",
        "text-left transition-all duration-200",
        // Interactive states
        "hover:bg-black/[0.03] active:bg-black/[0.05] active:scale-[0.99]",
        // Selected state
        isSelected && "bg-black/[0.04] ring-1 ring-black/10",
        // Focus state for accessibility
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
      )}
      style={{ paddingLeft: `${12 + span.depth * 20}px` }}
      onClick={onSelect}
    >
      {/* Hierarchy connector for nested spans */}
      {span.depth > 0 && (
        <ChevronRight className="h-3 w-3 text-black/20 shrink-0 -ml-1" />
      )}

      {/* Type icon in colored badge */}
      <div className={cn(
        "shrink-0 p-2 rounded-lg",
        config.bgColor
      )}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name - NO truncation on mobile for readability */}
        <p className="text-sm font-medium text-black/90 leading-tight">
          {span.name}
        </p>

        {/* Meta row: type label + status */}
        <div className="flex items-center gap-2 mt-1">
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
          <span className="text-black/20">·</span>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
            <span className={cn("text-xs font-medium", status.text)}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Duration - right aligned */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold text-black/70 tabular-nums">
          {formatDuration(spanDuration)}
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Desktop Timeline Row (Gantt chart style)
// ============================================================================

interface DesktopTimelineRowProps {
  span: FlattenedSpan
  isSelected: boolean
  onSelect: () => void
  traceStartTime: number
  traceDuration: number
  currentTime: number
}

function DesktopTimelineRow({
  span,
  isSelected,
  onSelect,
  traceStartTime,
  traceDuration,
  currentTime
}: DesktopTimelineRowProps): React.JSX.Element {
  const config = typeConfig[span.type] || typeConfig.CUSTOM
  const Icon = config.icon

  const spanStart = new Date(span.startedAt).getTime()
  const spanDuration = span.duration || (span.status === 'RUNNING' ? currentTime - spanStart : 0)

  const offsetPercent = ((spanStart - traceStartTime) / traceDuration) * 100
  const widthPercent = Math.max((spanDuration / traceDuration) * 100, 0.5)

  const barColorClass = span.status === 'FAILED'
    ? 'bg-red-500'
    : span.status === 'RUNNING'
      ? 'bg-violet-500 animate-pulse'
      : config.barColor

  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center h-9 rounded-lg transition-all duration-150",
        "hover:bg-black/[0.03]",
        isSelected && "bg-black/[0.05] ring-1 ring-black/10",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
      )}
      onClick={onSelect}
    >
      {/* Name column */}
      <div
        className="w-52 shrink-0 flex items-center gap-2 px-2 overflow-hidden"
        style={{ paddingLeft: `${8 + span.depth * 16}px` }}
      >
        {/* Depth indicator */}
        {span.depth > 0 && (
          <div className="flex items-center">
            {Array.from({ length: span.depth }).map((_, i) => (
              <div key={i} className="w-3 h-px bg-black/10" />
            ))}
          </div>
        )}

        <div className={cn("shrink-0", config.color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <span className="text-xs font-medium text-black/70 truncate">
          {span.name}
        </span>
      </div>

      {/* Timeline bar */}
      <div className="flex-1 relative h-5 mx-2 overflow-hidden">
        <div className="absolute inset-0 bg-black/[0.02] rounded" />
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded transition-all",
            barColorClass
          )}
          style={{
            left: `${Math.min(offsetPercent, 99)}%`,
            width: `${Math.min(widthPercent, 100 - offsetPercent)}%`,
            minWidth: '4px',
          }}
        />
      </div>

      {/* Duration */}
      <div className="w-28 shrink-0 flex items-center justify-end gap-2 pr-2 text-xs">
        {span.cost && span.cost > 0 && (
          <span className="text-black/40 tabular-nums">
            ${span.cost.toFixed(4)}
          </span>
        )}
        <span className="text-black/60 tabular-nums font-medium w-14 text-right">
          {formatDuration(spanDuration)}
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Time Markers
// ============================================================================

function TimeMarkers({ duration }: { duration: number }): React.JSX.Element {
  const markers = useMemo(() => {
    const count = 4
    const result = []
    for (let i = 0; i <= count; i++) {
      const time = (duration * i) / count
      result.push({
        position: (i / count) * 100,
        label: formatDuration(time),
        isFirst: i === 0,
        isLast: i === count,
      })
    }
    return result
  }, [duration])

  return (
    <>
      {markers.map((marker, i) => (
        <div
          key={i}
          className="absolute top-0 h-full flex flex-col"
          style={{
            left: `${marker.position}%`,
            transform: marker.isFirst ? 'none' : marker.isLast ? 'translateX(-100%)' : 'translateX(-50%)',
          }}
        >
          <div
            className="h-2 w-px bg-black/20"
            style={{
              marginLeft: marker.isFirst ? 0 : 'auto',
              marginRight: marker.isFirst ? 'auto' : marker.isLast ? 0 : 'auto'
            }}
          />
          <span className="text-[10px] text-black/40 mt-0.5 whitespace-nowrap">
            {marker.label}
          </span>
        </div>
      ))}
    </>
  )
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}
