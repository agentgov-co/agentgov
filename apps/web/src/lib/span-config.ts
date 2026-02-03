import {
  Bot,
  Wrench,
  Database,
  Sparkles,
  Code,
} from 'lucide-react'
import type { SpanType, SpanStatus, TraceStatus } from '@/lib/api'

// ============================================
// Type Config — shared across span-tree, span-details
// ============================================

export interface TypeConfig {
  icon: typeof Bot
  label: string
  shortLabel: string
  color: string
  bgColor: string
}

export const typeConfig: Record<SpanType, TypeConfig> = {
  LLM_CALL: { icon: Bot, label: 'LLM Call', shortLabel: 'LLM', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  TOOL_CALL: { icon: Wrench, label: 'Tool Call', shortLabel: 'Tool', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  AGENT_STEP: { icon: Sparkles, label: 'Agent Step', shortLabel: 'Agent', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  RETRIEVAL: { icon: Database, label: 'Retrieval', shortLabel: 'Retrieval', color: 'text-green-600', bgColor: 'bg-green-50' },
  EMBEDDING: { icon: Database, label: 'Embedding', shortLabel: 'Embed', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  CUSTOM: { icon: Code, label: 'Custom', shortLabel: 'Custom', color: 'text-gray-600', bgColor: 'bg-gray-50' },
}

// ============================================
// Span Status Config — shared across span-tree, span-details
// ============================================

export interface SpanStatusConfig {
  label: string
  dot: string
  color: string
  bgColor: string
}

export const spanStatusConfig: Record<SpanStatus, SpanStatusConfig> = {
  RUNNING: { label: 'Running', dot: 'bg-violet-500 animate-pulse', color: 'text-violet-600', bgColor: 'bg-violet-50' },
  COMPLETED: { label: 'Completed', dot: 'bg-green-500', color: 'text-green-600', bgColor: 'bg-green-50' },
  FAILED: { label: 'Failed', dot: 'bg-red-500', color: 'text-red-600', bgColor: 'bg-red-50' },
}

// ============================================
// Trace Status Config — shared across dashboard, recent-traces
// ============================================

export interface TraceStatusConfig {
  label: string
  dot: string
  color: string
}

export const traceStatusConfig: Record<TraceStatus, TraceStatusConfig> = {
  RUNNING: { label: 'Running', dot: 'bg-violet-500', color: 'text-violet-600' },
  COMPLETED: { label: 'Done', dot: 'bg-green-500', color: 'text-green-600' },
  FAILED: { label: 'Error', dot: 'bg-red-500', color: 'text-red-600' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-gray-400', color: 'text-gray-600' },
}

// ============================================
// Trace Status Colors (for badges) — shared across recent-traces
// ============================================

export const traceStatusColors: Record<TraceStatus, string> = {
  RUNNING: 'bg-violet-500',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-500',
}

// ============================================
// Format Duration — shared across span-tree, span-details
// ============================================

export function formatDuration(ms: number): string {
  if (ms < 1) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}
