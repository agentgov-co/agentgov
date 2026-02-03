'use client'

import React from 'react'
import { useTraces } from '@/hooks/use-traces'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, DollarSign, Clock, Zap } from 'lucide-react'

interface StatsCardsProps {
  projectId?: string
}

export function StatsCards({ projectId }: StatsCardsProps): React.JSX.Element {
  const { data } = useTraces({
    projectId: projectId || '',
    limit: 100
  })

  const traces = data?.data || []

  // Calculate stats
  const totalTraces = traces.length
  const completedTraces = traces.filter(t => t.status === 'COMPLETED').length
  const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0)
  const totalTokens = traces.reduce((sum, t) => sum + (t.totalTokens || 0), 0)
  const avgDuration = traces.length > 0
    ? traces.reduce((sum, t) => sum + (t.totalDuration || 0), 0) / traces.length
    : 0

  const stats = [
    {
      title: 'Total Traces',
      value: totalTraces.toLocaleString(),
      icon: Activity,
      description: `${completedTraces} completed`
    },
    {
      title: 'Total Cost',
      value: `$${totalCost.toFixed(4)}`,
      icon: DollarSign,
      description: 'Estimated'
    },
    {
      title: 'Total Tokens',
      value: totalTokens.toLocaleString(),
      icon: Zap,
      description: 'Input + Output'
    },
    {
      title: 'Avg Duration',
      value: `${(avgDuration / 1000).toFixed(2)}s`,
      icon: Clock,
      description: 'Per trace'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
