'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { Span } from '@/lib/api'
import {
  Sparkles,
  X,
  Clock,
  DollarSign,
  Zap,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'
import { typeConfig, spanStatusConfig, formatDuration } from '@/lib/span-config'

interface SpanDetailsProps {
  span: Span
  onClose: () => void
  hideCloseButton?: boolean
}

export function SpanDetails({ span, onClose, hideCloseButton }: SpanDetailsProps): React.JSX.Element {
  const config = typeConfig[span.type] || typeConfig.CUSTOM
  const status = spanStatusConfig[span.status]
  const Icon = config.icon

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-black/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("p-2 rounded-lg shrink-0", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{span.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-black/50">
                <span className={cn("px-1.5 py-0.5 rounded font-medium", config.bgColor, config.color)}>
                  {config.label}
                </span>
                <ChevronRight className="h-3 w-3" />
                <span className={cn("px-1.5 py-0.5 rounded font-medium", status.bgColor, status.color)}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          {!hideCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
              aria-label="Close span details"
              title="Close span details"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="shrink-0 p-4 border-b border-black/10 grid grid-cols-3 gap-4">
        <MetricCard
          icon={Clock}
          label="Duration"
          value={span.duration ? formatDuration(span.duration) : '-'}
        />
        <MetricCard
          icon={DollarSign}
          label="Cost"
          value={span.cost ? `$${span.cost.toFixed(4)}` : '-'}
        />
        <MetricCard
          icon={Zap}
          label="Tokens"
          value={
            span.promptTokens != null
              ? `${span.promptTokens} / ${span.outputTokens || 0}`
              : '-'
          }
          subLabel={span.promptTokens != null ? 'in / out' : undefined}
        />
      </div>

      {/* Model info for LLM calls */}
      {span.model && (
        <div className="shrink-0 px-4 py-3 border-b border-black/10 bg-black/[0.02]">
          <span className="text-xs text-black/50">Model:</span>
          <span className="ml-2 text-sm font-mono font-medium">{span.model}</span>
        </div>
      )}

      {/* Error */}
      {span.error && (
        <div className="shrink-0 m-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">Error</p>
              <p className="text-sm text-red-700">{span.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input/Output tabs */}
      <div className="flex-1 min-h-0 p-4">
        <Tabs defaultValue="input" className="h-full flex flex-col">
          <TabsList variant="underline" className="shrink-0">
            <TabsTrigger value="input" variant="underline">
              Input
            </TabsTrigger>
            <TabsTrigger value="output" variant="underline">
              Output
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="flex-1 min-h-0 mt-3">
            <JsonViewer data={span.input} placeholder="No input data" />
          </TabsContent>

          <TabsContent value="output" className="flex-1 min-h-0 mt-3">
            <JsonViewer data={span.output} placeholder="No output data" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer with timing */}
      <div className="shrink-0 px-4 py-3 border-t border-black/10 bg-black/[0.02] text-xs text-black/50">
        Started {formatDistanceToNow(new Date(span.startedAt), { addSuffix: true })}
        {span.endedAt && (
          <span className="ml-2">
            · Ended {formatDistanceToNow(new Date(span.endedAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: typeof Clock
  label: string
  value: string
  subLabel?: string
}

function MetricCard({ icon: Icon, label, value, subLabel }: MetricCardProps): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-black/40 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-semibold tabular-nums">{value}</p>
      {subLabel && <p className="text-[10px] text-black/40">{subLabel}</p>}
    </div>
  )
}

interface JsonViewerProps {
  data: Record<string, unknown> | null
  placeholder?: string
}

function JsonViewer({ data, placeholder = 'No data' }: JsonViewerProps): React.JSX.Element {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-black/40 text-sm">
        {placeholder}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-lg border border-black/10 bg-black/[0.02]">
      <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
        <JsonHighlight data={data} />
      </pre>
    </div>
  )
}

// Token types for JSON syntax highlighting
type JsonTokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation'

const tokenColors: Record<JsonTokenType, string> = {
  key: 'text-purple-600',
  string: 'text-green-600',
  number: 'text-blue-600',
  boolean: 'text-amber-600',
  null: 'text-red-500',
  punctuation: '',
}

interface JsonToken {
  type: JsonTokenType
  value: string
}

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = []
  const regex = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\]:,\s]+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(json)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ type: 'key', value: match[1] })
      // Preserve any whitespace between key and colon captured by \s*
      const fullMatch = match[0]
      const colonIndex = fullMatch.lastIndexOf(':')
      const between = fullMatch.slice(match[1].length, colonIndex)
      tokens.push({ type: 'punctuation', value: between + ':' })
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'string', value: match[2] })
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'number', value: match[3] })
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'boolean', value: match[4] })
    } else if (match[5] !== undefined) {
      tokens.push({ type: 'null', value: match[5] })
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'punctuation', value: match[6] })
    }
  }
  return tokens
}

function JsonHighlight({ data }: { data: unknown }): React.JSX.Element {
  const json = JSON.stringify(data, null, 2)
  const tokens = tokenizeJson(json)

  return (
    <>
      {tokens.map((token, i) => (
        token.type === 'punctuation'
          ? <span key={i}>{token.value}</span>
          : <span key={i} className={tokenColors[token.type]}>{token.value}</span>
      ))}
    </>
  )
}

// Empty state component
export function SpanDetailsEmpty(): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white">
      <div className="p-4 bg-black/5 rounded-full mb-4">
        <Sparkles className="h-8 w-8 text-black/30" />
      </div>
      <h3 className="font-medium text-black/70 mb-2">No span selected</h3>
      <p className="text-sm text-black/40 max-w-[200px]">
        Click on a span in the timeline to view its details
      </p>
    </div>
  )
}
