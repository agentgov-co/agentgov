'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useSelectedProject } from '@/hooks/use-selected-project'
import { useTraces } from '@/hooks/use-traces'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, subDays, format, startOfDay } from 'date-fns'
import {
  Activity,
  TrendingUp,
  DollarSign,
  Zap,
  ArrowRight,
  FolderOpen,
  Bot
} from 'lucide-react'
import { traceStatusConfig } from '@/lib/span-config'
import type { Trace } from '@/lib/api'

export default function DashboardPage(): React.JSX.Element {
  const { selectedProjectId } = useSelectedProject()
  const { data, isLoading } = useTraces({ projectId: selectedProjectId || '', limit: 50 })

  const stats = useMemo(() => {
    if (!data?.data) return null
    const traces = data.data
    const totalTraces = traces.length
    const runningTraces = traces.filter(t => t.status === 'RUNNING').length
    const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0)
    const totalTokens = traces.reduce((sum, t) => sum + (t.totalTokens || 0), 0)
    return { totalTraces, runningTraces, totalCost, totalTokens }
  }, [data])

  const chartData = useMemo(() => {
    if (!data?.data) return []
    const traces = data.data
    const days = 7
    const result: { date: string; label: string; count: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i))
      const nextDate = startOfDay(subDays(new Date(), i - 1))
      const count = traces.filter(t => {
        const traceDate = new Date(t.startedAt)
        return traceDate >= date && traceDate < nextDate
      }).length
      result.push({
        date: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE'),
        count
      })
    }
    return result
  }, [data])

  const recentTraces = useMemo(() => {
    if (!data?.data) return []
    return data.data.slice(0, 5)
  }, [data])

  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  if (!selectedProjectId) {
    return (
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-black/10 px-6 py-4">
          <h1 className="font-semibold text-lg">Dashboard</h1>
          <p className="text-sm text-black/50">Overview of your agent activity</p>
        </div>
        <div className="p-6">
          <div className="bg-white rounded-lg border border-black/10 p-16 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-black/20" />
            <h3 className="font-medium text-lg mb-2">No project selected</h3>
            <p className="text-black/50 mb-4">
              Select a project from the header to view analytics.
            </p>
            <Button asChild>
              <Link href="/dashboard/projects">Go to Projects</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <h1 className="font-semibold text-lg">Dashboard</h1>
        <p className="text-sm text-black/50">Overview of your agent activity</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white p-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black/50">Total Traces</p>
                  <p className="text-2xl font-semibold mt-1">
                    {stats?.totalTraces || 0}
                  </p>
                </div>
                <div className="p-2.5 bg-violet-50 rounded-lg">
                  <Activity className="h-5 w-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white p-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black/50">Active Now</p>
                  <p className="text-2xl font-semibold mt-1">
                    {stats?.runningTraces || 0}
                  </p>
                </div>
                <div className="p-2.5 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white p-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black/50">Total Cost</p>
                  <p className="text-2xl font-semibold mt-1">
                    ${stats?.totalCost?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white p-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black/50">Total Tokens</p>
                  <p className="text-2xl font-semibold mt-1">
                    {stats?.totalTokens?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart and Recent Traces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <Card className="bg-white p-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold">Traces Over Time</h2>
                  <p className="text-sm text-black/50">Last 7 days</p>
                </div>
              </div>

              <div className="h-48 flex items-end gap-2">
                {chartData.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-black/[0.03] rounded-t relative" style={{ height: '160px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-violet-500 rounded-t transition-all duration-300"
                        style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-xs text-black/40">{day.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Traces */}
          <Card className="bg-white p-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold">Recent Traces</h2>
                  <p className="text-sm text-black/50">Latest executions</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-black/50 hover:text-black">
                  <Link href="/dashboard/traces">
                    View all
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>

              {recentTraces.length > 0 ? (
                <div className="space-y-3">
                  {recentTraces.map((trace) => (
                    <TraceItem key={trace.id} trace={trace} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-black/20" />
                  <p className="text-black/50 text-sm">No traces yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function TraceItem({ trace }: { trace: Trace }): React.JSX.Element {
  const status = traceStatusConfig[trace.status]

  return (
    <Link
      href={`/dashboard/traces/${trace.id}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/[0.02] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {trace.name || `Trace ${trace.id.slice(0, 8)}`}
        </p>
        <p className="text-xs text-black/40">
          {formatDistanceToNow(new Date(trace.startedAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
        <span className={cn('text-xs font-medium', status.color)}>
          {status.label}
        </span>
      </div>
    </Link>
  )
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    </main>
  )
}
