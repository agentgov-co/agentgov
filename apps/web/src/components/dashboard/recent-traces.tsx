'use client'

import React from 'react'
import Link from 'next/link'
import { useTraces } from '@/hooks/use-traces'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { traceStatusColors } from '@/lib/span-config'

interface RecentTracesProps {
  projectId: string
}

export function RecentTraces({ projectId }: RecentTracesProps): React.JSX.Element {
  const { data, isLoading } = useTraces({
    projectId,
    limit: 5
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }

  const traces = data?.data || []

  if (traces.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No traces yet. Start sending data from your agents.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {traces.map((trace) => (
        <Link
          key={trace.id}
          href={`/dashboard/traces/${trace.id}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1">
                  <span className={`h-2 w-2 rounded-full ${traceStatusColors[trace.status]}`} />
                  {trace.status}
                </Badge>
                <span className="font-medium">
                  {trace.name || `Trace ${trace.id.slice(0, 8)}`}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {trace.totalTokens && (
                  <span>{trace.totalTokens.toLocaleString()} tokens</span>
                )}
                {trace.totalCost && (
                  <span>${trace.totalCost.toFixed(4)}</span>
                )}
                <span>
                  {formatDistanceToNow(new Date(trace.startedAt), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
