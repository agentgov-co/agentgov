'use client'

import Link from 'next/link'
import { useComplianceSystems, useComplianceStats } from '@/hooks/use-compliance'
import { useSelectedProject } from '@/hooks/use-selected-project'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Shield,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  MoreVertical,
  Trash2,
  ExternalLink,
  FileWarning,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDeleteSystem } from '@/hooks/use-compliance'
import { toast } from 'sonner'
import type { RiskLevel, ComplianceStatus, AISystem } from '@/lib/api'

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; icon: typeof Shield; label: string }> = {
  PROHIBITED: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertOctagon, label: 'Prohibited' },
  HIGH: { color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle, label: 'High' },
  LIMITED: { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Info, label: 'Limited' },
  MINIMAL: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2, label: 'Minimal' },
  UNKNOWN: { color: 'text-gray-600', bg: 'bg-gray-100', icon: Shield, label: 'Unknown' },
}

const STATUS_CONFIG: Record<ComplianceStatus, { color: string; label: string }> = {
  NOT_ASSESSED: { color: 'bg-gray-100 text-gray-700', label: 'Not Assessed' },
  IN_PROGRESS: { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  COMPLIANT: { color: 'bg-green-100 text-green-700', label: 'Compliant' },
  NON_COMPLIANT: { color: 'bg-red-100 text-red-700', label: 'Non-Compliant' },
  EXEMPT: { color: 'bg-purple-100 text-purple-700', label: 'Exempt' },
}

export default function ComplianceDashboardPage(): React.JSX.Element {
  const { selectedProjectId } = useSelectedProject()
  const { data: stats, isLoading: statsLoading } = useComplianceStats(selectedProjectId || undefined)
  const { data: systemsData, isLoading: systemsLoading } = useComplianceSystems({
    projectId: selectedProjectId || undefined,
    limit: 10,
  })

  const isLoading = statsLoading || systemsLoading

  if (isLoading) {
    return <ComplianceDashboardSkeleton />
  }

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">EU AI Act Compliance</h1>
          <p className="text-sm text-black/50">
            Manage AI system compliance and documentation
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/compliance/assess">
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Link>
        </Button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Systems"
            value={stats?.totalSystems || 0}
            icon={Shield}
          />
          <StatsCard
            title="High Risk"
            value={stats?.byRiskLevel?.HIGH || 0}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatsCard
            title="Pending Obligations"
            value={stats?.pendingObligations || 0}
            icon={FileWarning}
            variant="info"
          />
          <StatsCard
            title="Compliant"
            value={stats?.byComplianceStatus?.COMPLIANT || 0}
            icon={CheckCircle2}
            variant="success"
          />
        </div>

        {/* Risk Level Distribution */}
        {stats && stats.totalSystems > 0 && (
          <div className="bg-white rounded-2xl border border-black/10 p-6">
            <h3 className="font-medium mb-4">Risk Level Distribution</h3>
            <div className="flex gap-2">
              {Object.entries(RISK_CONFIG).map(([level, config]) => {
                const count = stats.byRiskLevel?.[level as RiskLevel] || 0
                if (count === 0) return null
                const percentage = (count / stats.totalSystems) * 100
                return (
                  <div
                    key={level}
                    className={cn('h-8 rounded flex items-center justify-center text-xs font-medium', config.bg, config.color)}
                    style={{ width: `${Math.max(percentage, 10)}%` }}
                    title={`${config.label}: ${count}`}
                  >
                    {count}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              {Object.entries(RISK_CONFIG).map(([level, config]) => {
                const count = stats.byRiskLevel?.[level as RiskLevel] || 0
                if (count === 0) return null
                return (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className={cn('h-2.5 w-2.5 rounded-full', config.bg)} />
                    <span className="text-black/60">{config.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI Systems Table */}
        <div className="bg-white rounded-2xl border border-black/10">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <h3 className="font-medium">AI Systems</h3>
            <Link
              href="/dashboard/compliance/assess"
              className="text-sm text-primary hover:underline"
            >
              + Add System
            </Link>
          </div>

          {systemsData?.data && systemsData.data.length > 0 ? (
            <div className="divide-y divide-black/5">
              {systemsData.data.map((system) => (
                <SystemRow key={system.id} system={system} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-black/20" />
              <h3 className="font-medium text-lg mb-2">No AI systems registered</h3>
              <p className="text-black/50 mb-4">
                Start by assessing your first AI system for EU AI Act compliance.
              </p>
              <Button asChild>
                <Link href="/dashboard/compliance/assess">
                  <Plus className="mr-2 h-4 w-4" />
                  Start Assessment
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        {stats?.recentIncidents && stats.recentIncidents.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/10">
            <div className="px-5 py-4 border-b border-black/10">
              <h3 className="font-medium">Recent Incidents</h3>
            </div>
            <div className="divide-y divide-black/5">
              {stats.recentIncidents.map((incident) => (
                <div key={incident.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{incident.title}</div>
                    <div className="text-xs text-black/50">
                      {incident.aiSystem?.name} &middot;{' '}
                      {formatDistanceToNow(new Date(incident.occurredAt), { addSuffix: true })}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      incident.severity === 'CRITICAL' && 'bg-red-100 text-red-700',
                      incident.severity === 'HIGH' && 'bg-orange-100 text-orange-700',
                      incident.severity === 'MEDIUM' && 'bg-yellow-100 text-yellow-700',
                      incident.severity === 'LOW' && 'bg-green-100 text-green-700'
                    )}
                  >
                    {incident.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatsCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: number
  icon: typeof Shield
  variant?: 'default' | 'warning' | 'success' | 'info'
}): React.JSX.Element {
  const variants = {
    default: 'bg-black/5 text-black',
    warning: 'bg-orange-100 text-orange-700',
    success: 'bg-green-100 text-green-600',
    info: 'bg-blue-100 text-blue-600',
  }

  return (
    <div className="bg-white rounded-2xl border border-black/10 p-5">
      <div className="flex items-center gap-4">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', variants[variant])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <span className="text-sm text-black/50">{title}</span>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </div>
  )
}

function SystemRow({ system }: { system: AISystem }): React.JSX.Element {
  const deleteSystem = useDeleteSystem()
  const riskConfig = RISK_CONFIG[system.riskLevel]
  const statusConfig = STATUS_CONFIG[system.complianceStatus]
  const RiskIcon = riskConfig.icon

  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-black/[0.02]">
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', riskConfig.bg)}>
          <RiskIcon className={cn('h-5 w-5', riskConfig.color)} />
        </div>
        <div className="min-w-0">
          <Link
            href={`/dashboard/compliance/systems/${system.id}`}
            className="font-medium hover:text-primary truncate block"
          >
            {system.name}
          </Link>
          <div className="text-sm text-black/50 truncate">
            {system.project?.name} &middot; {system.version || 'v1.0'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn('px-2 py-1 rounded text-xs font-medium', riskConfig.bg, riskConfig.color)}>
          {riskConfig.label}
        </span>
        <span className={cn('px-2 py-1 rounded text-xs font-medium', statusConfig.color)}>
          {statusConfig.label}
        </span>
        <div className="text-sm text-black/40 hidden sm:block">
          {formatDistanceToNow(new Date(system.createdAt), { addSuffix: true })}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="System options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/compliance/systems/${system.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                deleteSystem.mutate(system.id)
                toast.success('System deleted')
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function ComplianceDashboardSkeleton(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="p-6 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </main>
  )
}
