'use client'

import React, { useState, memo } from 'react'
import {
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { typeConfig, spanStatusConfig, formatDuration } from '@/lib/span-config'
import { useIsDesktop } from '@/hooks/use-mobile'
import type { Span } from '@/lib/api'

interface SpanTreeProps {
  spans: Span[]
  selectedSpanId?: string | null
  onSelectSpan?: (span: Span) => void
}

export function SpanTree({ spans, selectedSpanId, onSelectSpan }: SpanTreeProps): React.JSX.Element {
  const rootSpans = spans.filter(s => !s.parentId)
  const getChildren = (parentId: string): Span[] =>
    spans.filter(s => s.parentId === parentId)

  if (rootSpans.length === 0) {
    return <p className="text-black/50 text-center py-4">No spans</p>
  }

  return (
    <div className="space-y-0.5">
      {rootSpans.map((span, index) => (
        <SpanNode
          key={span.id}
          span={span}
          getChildren={getChildren}
          depth={0}
          isLast={index === rootSpans.length - 1}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
        />
      ))}
    </div>
  )
}

interface SpanNodeProps {
  span: Span
  getChildren: (id: string) => Span[]
  depth: number
  isLast: boolean
  selectedSpanId?: string | null
  onSelectSpan?: (span: Span) => void
}

export const SpanNode = memo(
  function SpanNode({ span, getChildren, depth, isLast, selectedSpanId, onSelectSpan }: SpanNodeProps) {
    const [expanded, setExpanded] = useState(true)
    const [showDetails, setShowDetails] = useState(false)
    const isDesktop = useIsDesktop()

    const children = getChildren(span.id)
    const hasChildren = children.length > 0
    const config = typeConfig[span.type] || typeConfig.CUSTOM
    const status = spanStatusConfig[span.status]
    const Icon = config.icon
    const isSelected = span.id === selectedSpanId

    const handleClick = (): void => {
      if (onSelectSpan) {
        onSelectSpan(span)
      } else {
        setShowDetails(!showDetails)
      }
    }

    const toggleExpand = (e: React.MouseEvent): void => {
      e.stopPropagation()
      setExpanded(!expanded)
    }

    // Desktop layout
    if (isDesktop) {
      return (
        <div className="relative">
          {/* Tree connectors */}
          {depth > 0 && (
            <>
              <div
                className="absolute left-0 top-0 w-px bg-black/10"
                style={{ left: `${depth * 20 - 10}px`, height: isLast ? '20px' : '100%' }}
              />
              <div
                className="absolute top-5 h-px bg-black/10"
                style={{ left: `${depth * 20 - 10}px`, width: '10px' }}
              />
            </>
          )}

          {/* Main row */}
          <div
            className={cn(
              "w-full flex items-center gap-2 p-2.5 rounded-lg",
              "transition-all duration-150",
              "hover:bg-black/[0.03]",
              (showDetails || isSelected) && "bg-black/[0.02]",
              isSelected && "ring-1 ring-black/10"
            )}
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {/* Expand/collapse */}
            {hasChildren ? (
              <button
                type="button"
                className="h-5 w-5 flex items-center justify-center text-black/30 hover:text-black/60 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded"
                onClick={toggleExpand}
                aria-label={expanded ? 'Collapse children' : 'Expand children'}
                title={expanded ? 'Collapse children' : 'Expand children'}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <div className="h-5 w-5 flex items-center justify-center shrink-0">
                <div className="h-1.5 w-1.5 rounded-full bg-black/20" />
              </div>
            )}

            {/* Clickable content area */}
            <button
              type="button"
              className="flex-1 flex items-center gap-2 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded"
              onClick={handleClick}
            >
              {/* Type badge */}
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium shrink-0",
                config.color, config.bgColor
              )}>
                <Icon className="h-3.5 w-3.5" />
                <span>{config.shortLabel}</span>
              </div>

              {/* Name */}
              <span className="font-medium text-sm text-black/80 flex-1 min-w-0 truncate">
                {span.name}
              </span>

              {/* Meta info */}
              <div className="flex items-center gap-3 text-xs shrink-0">
                {span.model && (
                  <span className="text-black/40 font-mono hidden xl:inline">{span.model}</span>
                )}
                {span.duration != null && (
                  <span className="text-black/50 tabular-nums w-16 text-right">
                    {formatDuration(span.duration)}
                  </span>
                )}
                {span.cost != null && span.cost > 0 && (
                  <span className="text-black/40 tabular-nums w-16 text-right hidden lg:inline">
                    ${span.cost.toFixed(4)}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
                  <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
                </div>
              </div>
            </button>
          </div>

          {/* Inline details panel (when no onSelectSpan) */}
          {showDetails && !onSelectSpan && (
            <DetailsPanel span={span} depth={depth} />
          )}

          {/* Children */}
          {expanded && hasChildren && children.map((child, index) => (
            <SpanNode
              key={child.id}
              span={child}
              getChildren={getChildren}
              depth={depth + 1}
              isLast={index === children.length - 1}
              selectedSpanId={selectedSpanId}
              onSelectSpan={onSelectSpan}
            />
          ))}
        </div>
      )
    }

    // Mobile layout
    return (
      <div className="relative">
        {/* Simple indentation line for mobile */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-black/5 rounded-full"
            style={{ left: `${depth * 16 - 4}px` }}
          />
        )}

        {/* Main row - touch-friendly */}
        <div
          className={cn(
            "w-full flex items-start gap-3 p-3 rounded-xl",
            "transition-all duration-200",
            "hover:bg-black/[0.03]",
            (showDetails || isSelected) && "bg-black/[0.04]",
            isSelected && "ring-1 ring-black/10"
          )}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {/* Expand/collapse - only show if has children */}
          {hasChildren ? (
            <button
              type="button"
              className="mt-0.5 h-6 w-6 flex items-center justify-center text-black/40 hover:text-black/60 transition-colors shrink-0 -ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded"
              onClick={toggleExpand}
              aria-label={expanded ? 'Collapse children' : 'Expand children'}
              title={expanded ? 'Collapse children' : 'Expand children'}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <div className="mt-0.5 h-6 w-6 flex items-center justify-center shrink-0 -ml-1">
              <div className="h-1.5 w-1.5 rounded-full bg-black/20" />
            </div>
          )}

          {/* Clickable content area */}
          <button
            type="button"
            className="flex-1 flex items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded-lg active:bg-black/[0.05] active:scale-[0.99]"
            onClick={handleClick}
          >
            {/* Type icon */}
            <div className={cn("shrink-0 p-2 rounded-lg mt-0.5", config.bgColor)}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name - full, no truncation */}
              <p className="text-sm font-medium text-black/90 leading-tight">
                {span.name}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn("text-xs font-medium", config.color)}>
                  {config.shortLabel}
                </span>
                <span className="text-black/20">&middot;</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
                  <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
                </div>
                {span.duration != null && (
                  <>
                    <span className="text-black/20">&middot;</span>
                    <span className="text-xs text-black/50 tabular-nums">
                      {formatDuration(span.duration)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Inline details panel (when no onSelectSpan) */}
        {showDetails && !onSelectSpan && (
          <DetailsPanel span={span} depth={depth} mobile />
        )}

        {/* Children */}
        {expanded && hasChildren && children.map((child, index) => (
          <SpanNode
            key={child.id}
            span={child}
            getChildren={getChildren}
            depth={depth + 1}
            isLast={index === children.length - 1}
            selectedSpanId={selectedSpanId}
            onSelectSpan={onSelectSpan}
          />
        ))}
      </div>
    )
  },
  (prev, next) => {
    return (
      prev.span.id === next.span.id &&
      prev.span.status === next.span.status &&
      prev.depth === next.depth &&
      prev.isLast === next.isLast &&
      prev.selectedSpanId === next.selectedSpanId &&
      prev.onSelectSpan === next.onSelectSpan &&
      prev.getChildren === next.getChildren
    )
  }
)

// ============================================================================
// Details Panel (inline expansion)
// ============================================================================

interface DetailsPanelProps {
  span: Span
  depth: number
  mobile?: boolean
}

function DetailsPanel({ span, depth, mobile }: DetailsPanelProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "bg-black/[0.02] border border-black/5 rounded-xl p-4 my-1 text-sm",
        mobile ? "mx-3" : ""
      )}
      style={{ marginLeft: mobile ? `${depth * 16 + 12}px` : `${depth * 20 + 28}px` }}
    >
      <div className={cn("grid gap-4 text-xs", mobile ? "grid-cols-2" : "grid-cols-3")}>
        <div>
          <p className="text-black/40 mb-1">Type</p>
          <p className="font-medium">{span.type.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-black/40 mb-1">Duration</p>
          <p className="font-medium tabular-nums">{span.duration ? formatDuration(span.duration) : '0ms'}</p>
        </div>
        {span.promptTokens != null && (
          <div>
            <p className="text-black/40 mb-1">Tokens</p>
            <p className="font-medium tabular-nums">
              {span.promptTokens} <span className="text-black/30">in</span> / {span.outputTokens || 0} <span className="text-black/30">out</span>
            </p>
          </div>
        )}
      </div>

      {span.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-red-600 text-xs font-medium mb-1">Error</p>
          <p className="text-red-700 text-xs">{span.error}</p>
        </div>
      )}

      {span.input && (
        <div className="mt-4">
          <p className="text-black/40 text-xs mb-2">Input</p>
          <pre className="bg-white border border-black/10 p-3 rounded-lg text-xs overflow-auto max-h-32 font-mono">
            {JSON.stringify(span.input, null, 2)}
          </pre>
        </div>
      )}

      {span.output && (
        <div className="mt-4">
          <p className="text-black/40 text-xs mb-2">Output</p>
          <pre className="bg-white border border-black/10 p-3 rounded-lg text-xs overflow-auto max-h-32 font-mono">
            {JSON.stringify(span.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
