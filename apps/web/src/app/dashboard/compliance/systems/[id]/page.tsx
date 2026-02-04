'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import {
  useComplianceSystem,
  useUpdateObligation,
  useGenerateDocument,
  useCreateIncident,
  useUpdateOversight,
} from '@/hooks/use-compliance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  Shield,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  FileText,
  AlertCircle,
  Users,
  Plus,
  Check,
  Clock,
  XCircle,
  Activity,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import type {
  RiskLevel,
  ComplianceStatus,
  ObligationStatus,
  DocumentType,
  IncidentSeverity,
  IncidentType,
} from '@/lib/api'

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; icon: typeof Shield; label: string }> = {
  PROHIBITED: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertOctagon, label: 'Prohibited' },
  HIGH: { color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle, label: 'High Risk' },
  LIMITED: { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Info, label: 'Limited Risk' },
  MINIMAL: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2, label: 'Minimal Risk' },
  UNKNOWN: { color: 'text-gray-600', bg: 'bg-gray-100', icon: Shield, label: 'Unknown' },
}

const STATUS_CONFIG: Record<ComplianceStatus, { color: string; label: string }> = {
  NOT_ASSESSED: { color: 'bg-gray-100 text-gray-700', label: 'Not Assessed' },
  IN_PROGRESS: { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  COMPLIANT: { color: 'bg-green-100 text-green-700', label: 'Compliant' },
  NON_COMPLIANT: { color: 'bg-red-100 text-red-700', label: 'Non-Compliant' },
  EXEMPT: { color: 'bg-purple-100 text-purple-700', label: 'Exempt' },
}

const OBLIGATION_STATUS_CONFIG: Record<ObligationStatus, { icon: typeof Check; color: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-gray-500', label: 'Pending' },
  IN_PROGRESS: { icon: Clock, color: 'text-blue-500', label: 'In Progress' },
  COMPLETED: { icon: Check, color: 'text-green-500', label: 'Completed' },
  NOT_APPLICABLE: { icon: XCircle, color: 'text-gray-400', label: 'N/A' },
}

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: 'TECHNICAL_DOCUMENTATION', label: 'Technical Documentation', description: 'Article 11' },
  { value: 'RISK_MANAGEMENT', label: 'Risk Management Plan', description: 'Article 9' },
  { value: 'DATA_GOVERNANCE', label: 'Data Governance', description: 'Article 10' },
  { value: 'HUMAN_OVERSIGHT', label: 'Human Oversight', description: 'Article 14' },
  { value: 'CONFORMITY_DECLARATION', label: 'EU Declaration of Conformity', description: 'Article 47' },
  { value: 'FRIA', label: 'Fundamental Rights Impact Assessment', description: 'FRIA' },
  { value: 'TRANSPARENCY_NOTICE', label: 'Transparency Notice', description: 'Article 50' },
  { value: 'POST_MARKET_MONITORING', label: 'Post-Market Monitoring Plan', description: 'Article 72' },
]

export default function SystemDetailPage(): React.JSX.Element {
  const params = useParams()
  const systemId = params.id as string
  const { data: system, isLoading } = useComplianceSystem(systemId)

  if (isLoading) {
    return <SystemDetailSkeleton />
  }

  if (!system) {
    return (
      <main className="flex-1 overflow-auto">
        <div className="p-6 text-center">
          <h1 className="text-lg font-medium">System not found</h1>
          <Button asChild className="mt-4">
            <Link href="/dashboard/compliance">Back to Compliance</Link>
          </Button>
        </div>
      </main>
    )
  }

  const riskConfig = RISK_CONFIG[system.riskLevel]
  const statusConfig = STATUS_CONFIG[system.complianceStatus]
  const RiskIcon = riskConfig.icon

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-1" aria-label="Back to compliance" asChild>
              <Link href="/dashboard/compliance">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-semibold text-lg">{system.name}</h1>
                <span className={cn('px-2 py-1 rounded text-xs font-medium', riskConfig.bg, riskConfig.color)}>
                  {riskConfig.label}
                </span>
                <span className={cn('px-2 py-1 rounded text-xs font-medium', statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-black/50">
                {system.project?.name} &middot; {system.version || 'v1.0'} &middot;
                Assessed {system.assessedAt ? formatDistanceToNow(new Date(system.assessedAt), { addSuffix: true }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', riskConfig.bg)}>
            <RiskIcon className={cn('h-6 w-6', riskConfig.color)} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList variant="underline">
            <TabsTrigger variant="underline" value="overview">Overview</TabsTrigger>
            <TabsTrigger variant="underline" value="obligations">
              Obligations
              {system.obligations && system.obligations.filter(o => o.status === 'PENDING').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                  {system.obligations.filter(o => o.status === 'PENDING').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger variant="underline" value="documents">Documents</TabsTrigger>
            <TabsTrigger variant="underline" value="incidents">Incidents</TabsTrigger>
            <TabsTrigger variant="underline" value="oversight">Oversight</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab system={system} />
          </TabsContent>

          <TabsContent value="obligations">
            <ObligationsTab system={system} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab system={system} />
          </TabsContent>

          <TabsContent value="incidents">
            <IncidentsTab system={system} />
          </TabsContent>

          <TabsContent value="oversight">
            <OversightTab system={system} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

// ============================================
// Tab Components
// ============================================

function OverviewTab({ system }: { system: NonNullable<ReturnType<typeof useComplianceSystem>['data']> }): React.JSX.Element {
  // Use traces from the system response (linked to this AI system)
  const traces = system.traces || []
  const totalTraces = system._count?.traces || 0
  const recentCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0)
  const avgDuration = traces.length > 0
    ? traces.reduce((sum, t) => sum + (t.totalDuration || 0), 0) / traces.length
    : 0

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Classification Details */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Classification Details</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-black/50">Risk Level</dt>
            <dd className="font-medium">{RISK_CONFIG[system.riskLevel].label}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-black/50">Annex III Category</dt>
            <dd className="font-medium">{system.annexIIICategory || 'None'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-black/50">Deployed in EU</dt>
            <dd>{system.deployedInEU ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-black/50">Affects EU Citizens</dt>
            <dd>{system.affectsEUCitizens ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </div>

      {/* Intended Purpose */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Intended Purpose</h3>
        <p className="text-sm text-black/70">{system.intendedPurpose || 'Not specified'}</p>
        {system.intendedUsers && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-black/50 mb-1">Intended Users</h4>
            <p className="text-sm">{system.intendedUsers}</p>
          </div>
        )}
      </div>

      {/* Trace Metrics */}
      <div className="bg-white rounded-2xl border border-black/10 p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Activity
          </h3>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/traces">
              View All Traces
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-black/[0.02] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-black/50">Total Traces</span>
            </div>
            <div className="text-2xl font-semibold">{totalTraces}</div>
          </div>
          <div className="bg-black/[0.02] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-black/50">Avg Duration</span>
            </div>
            <div className="text-2xl font-semibold">
              {avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : '-'}
            </div>
          </div>
          <div className="bg-black/[0.02] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-black/50">Recent Cost</span>
            </div>
            <div className="text-2xl font-semibold">
              {recentCost > 0 ? `$${recentCost.toFixed(2)}` : '-'}
            </div>
          </div>
        </div>

        {/* Recent Traces */}
        {traces.length > 0 ? (
          <div className="border border-black/5 rounded-xl divide-y divide-black/5">
            {traces.map((trace) => (
              <Link
                key={trace.id}
                href={`/dashboard/traces/${trace.id}`}
                className="flex items-center justify-between p-3 hover:bg-black/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    trace.status === 'COMPLETED' && 'bg-green-500',
                    trace.status === 'FAILED' && 'bg-red-500',
                    trace.status === 'RUNNING' && 'bg-blue-500',
                    trace.status === 'CANCELLED' && 'bg-gray-400'
                  )} />
                  <div>
                    <div className="text-sm font-medium">{trace.name || trace.id.slice(0, 8)}</div>
                    <div className="text-xs text-black/50">
                      {formatDistanceToNow(new Date(trace.startedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-black/50">
                  {trace.totalDuration && (
                    <span>{(trace.totalDuration / 1000).toFixed(1)}s</span>
                  )}
                  {trace.totalCost && (
                    <span>${trace.totalCost.toFixed(3)}</span>
                  )}
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs',
                    trace.status === 'COMPLETED' && 'bg-green-100 text-green-700',
                    trace.status === 'FAILED' && 'bg-red-100 text-red-700',
                    trace.status === 'RUNNING' && 'bg-blue-100 text-blue-700',
                    trace.status === 'CANCELLED' && 'bg-gray-100 text-gray-700'
                  )}>
                    {trace.status.toLowerCase()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-black/50">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No traces recorded yet</p>
            <p className="text-xs">Traces will appear here once the system is active</p>
          </div>
        )}
      </div>

      {/* Risk Reasoning */}
      {system.riskReasoning && (
        <div className="bg-white rounded-2xl border border-black/10 p-6 lg:col-span-2">
          <h3 className="font-medium mb-4">Classification Reasoning</h3>
          <ul className="space-y-2">
            {system.riskReasoning.split('\n').map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-black/70">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-black/30 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Applicable Articles */}
      {system.applicableArticles.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/10 p-6 lg:col-span-2">
          <h3 className="font-medium mb-4">Applicable EU AI Act Articles</h3>
          <div className="flex flex-wrap gap-2">
            {system.applicableArticles.map((article) => (
              <span key={article} className="px-3 py-1.5 bg-black/5 rounded-xl text-sm">
                {article}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ObligationsTab({ system }: { system: NonNullable<ReturnType<typeof useComplianceSystem>['data']> }): React.JSX.Element {
  const updateObligation = useUpdateObligation()

  const handleStatusChange = async (obligationId: string, status: ObligationStatus): Promise<void> => {
    try {
      await updateObligation.mutateAsync({ id: obligationId, data: { status } })
      toast.success('Obligation updated')
    } catch {
      toast.error('Failed to update obligation')
    }
  }

  if (!system.obligations || system.obligations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/10 p-12 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <h3 className="font-medium text-lg mb-2">No obligations required</h3>
        <p className="text-black/50">
          This AI system has no specific compliance obligations under the EU AI Act.
        </p>
      </div>
    )
  }

  const completed = system.obligations.filter(o => o.status === 'COMPLETED' || o.status === 'NOT_APPLICABLE').length
  const total = system.obligations.length

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-black/50">Compliance Progress</span>
          <span className="text-sm font-medium">{completed} / {total}</span>
        </div>
        <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500 transition-all"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Obligations List */}
      <div className="bg-white rounded-2xl border border-black/10 divide-y divide-black/5">
        {system.obligations.map((obligation) => {
          const statusConfig = OBLIGATION_STATUS_CONFIG[obligation.status]
          const StatusIcon = statusConfig.icon

          return (
            <div key={obligation.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn('h-5 w-5 mt-0.5', statusConfig.color)} />
                  <div>
                    <div className="font-medium text-sm">{obligation.articleTitle}</div>
                    <div className="text-xs text-black/50 mb-1">{obligation.articleNumber}</div>
                    <p className="text-sm text-black/70">{obligation.description}</p>
                    {obligation.notes && (
                      <p className="text-xs text-black/50 mt-2 italic">{obligation.notes}</p>
                    )}
                  </div>
                </div>
                <Select
                  value={obligation.status}
                  onValueChange={(value) => handleStatusChange(obligation.id, value as ObligationStatus)}
                  disabled={updateObligation.isPending}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DocumentsTab({ system }: { system: NonNullable<ReturnType<typeof useComplianceSystem>['data']> }): React.JSX.Element {
  const generateDocument = useGenerateDocument()

  const handleGenerate = async (type: DocumentType): Promise<void> => {
    try {
      await generateDocument.mutateAsync({ aiSystemId: system.id, type })
      toast.success('Document generated')
    } catch {
      toast.error('Failed to generate document')
    }
  }

  const existingDocs = system.documents || []

  return (
    <div className="space-y-4">
      {/* Generate Document */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Generate Compliance Document</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DOCUMENT_TYPES.map((docType) => {
            const existing = existingDocs.find(d => d.type === docType.value)
            return (
              <button
                key={docType.value}
                onClick={() => handleGenerate(docType.value)}
                disabled={generateDocument.isPending}
                className={cn(
                  'p-4 border rounded-xl text-left transition-all duration-200 hover:shadow-sm',
                  existing ? 'border-green-200 bg-green-50' : 'border-black/10 hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-black/40" />
                  <span className="font-medium text-sm">{docType.label}</span>
                </div>
                <div className="text-xs text-black/50">{docType.description}</div>
                {existing && (
                  <div className="text-xs text-green-600 mt-2">
                    v{existing.version} &middot; {formatDistanceToNow(new Date(existing.updatedAt), { addSuffix: true })}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Existing Documents */}
      {existingDocs.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/10">
          <div className="px-5 py-4 border-b border-black/10">
            <h3 className="font-medium">Generated Documents</h3>
          </div>
          <div className="divide-y divide-black/5">
            {existingDocs.map((doc) => (
              <div key={doc.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{doc.title}</div>
                  <div className="text-xs text-black/50">
                    Version {doc.version} &middot; Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{doc.title}</DialogTitle>
                      <DialogDescription>Version {doc.version}</DialogDescription>
                    </DialogHeader>
                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-table:text-sm prose-th:bg-black/5 prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {doc.content}
                      </ReactMarkdown>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IncidentsTab({ system }: { system: NonNullable<ReturnType<typeof useComplianceSystem>['data']> }): React.JSX.Element {
  const createIncident = useCreateIncident()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM' as IncidentSeverity,
    type: 'MALFUNCTION' as IncidentType,
    occurredAt: new Date().toISOString().slice(0, 16),
    detectedAt: new Date().toISOString().slice(0, 16),
  })

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await createIncident.mutateAsync({
        aiSystemId: system.id,
        ...form,
        occurredAt: new Date(form.occurredAt),
        detectedAt: new Date(form.detectedAt),
      })
      toast.success('Incident reported')
      setDialogOpen(false)
      setForm({
        title: '',
        description: '',
        severity: 'MEDIUM',
        type: 'MALFUNCTION',
        occurredAt: new Date().toISOString().slice(0, 16),
        detectedAt: new Date().toISOString().slice(0, 16),
      })
    } catch {
      toast.error('Failed to report incident')
    }
  }

  return (
    <div className="space-y-4">
      {/* Report Incident Button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Report Incident</DialogTitle>
                <DialogDescription>
                  Document a serious incident for compliance tracking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Severity</Label>
                    <Select
                      value={form.severity}
                      onValueChange={(v) => setForm({ ...form, severity: v as IncidentSeverity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as IncidentType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAFETY">Safety</SelectItem>
                        <SelectItem value="FUNDAMENTAL_RIGHTS">Fundamental Rights</SelectItem>
                        <SelectItem value="MALFUNCTION">Malfunction</SelectItem>
                        <SelectItem value="MISUSE">Misuse</SelectItem>
                        <SelectItem value="SECURITY">Security</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="occurred">Occurred At</Label>
                    <Input
                      id="occurred"
                      type="datetime-local"
                      value={form.occurredAt}
                      onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="detected">Detected At</Label>
                    <Input
                      id="detected"
                      type="datetime-local"
                      value={form.detectedAt}
                      onChange={(e) => setForm({ ...form, detectedAt: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createIncident.isPending}>
                  {createIncident.isPending ? 'Submitting...' : 'Submit Report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incidents List */}
      {system.incidents && system.incidents.length > 0 ? (
        <div className="bg-white rounded-2xl border border-black/10 divide-y divide-black/5">
          {system.incidents.map((incident) => (
            <div key={incident.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className={cn(
                      'h-4 w-4',
                      incident.severity === 'CRITICAL' && 'text-red-500',
                      incident.severity === 'HIGH' && 'text-orange-500',
                      incident.severity === 'MEDIUM' && 'text-yellow-500',
                      incident.severity === 'LOW' && 'text-green-500'
                    )} />
                    <span className="font-medium text-sm">{incident.title}</span>
                  </div>
                  <p className="text-sm text-black/70 line-clamp-2">{incident.description}</p>
                  <div className="text-xs text-black/50 mt-2">
                    {format(new Date(incident.occurredAt), 'PPp')}
                    {incident.resolvedAt && (
                      <span className="text-green-600 ml-2">
                        Resolved {formatDistanceToNow(new Date(incident.resolvedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    incident.severity === 'CRITICAL' && 'bg-red-100 text-red-700',
                    incident.severity === 'HIGH' && 'bg-orange-100 text-orange-700',
                    incident.severity === 'MEDIUM' && 'bg-yellow-100 text-yellow-700',
                    incident.severity === 'LOW' && 'bg-green-100 text-green-700'
                  )}>
                    {incident.severity}
                  </span>
                  <span className="px-2 py-0.5 bg-black/5 rounded text-xs">
                    {incident.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/10 p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="font-medium text-lg mb-2">No incidents reported</h3>
          <p className="text-black/50">
            This AI system has no recorded incidents.
          </p>
        </div>
      )}
    </div>
  )
}

interface ResponsiblePerson {
  name: string
  email: string
  role: string
}

interface AlertThresholds {
  errorRate?: number
  latencyMs?: number
  confidenceMin?: number
}

function OversightTab({ system }: { system: NonNullable<ReturnType<typeof useComplianceSystem>['data']> }): React.JSX.Element {
  const updateOversight = useUpdateOversight()
  const config = system.oversightConfig
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [newPerson, setNewPerson] = useState<ResponsiblePerson>({ name: '', email: '', role: '' })

  // Parse existing responsible persons
  const responsiblePersons: ResponsiblePerson[] = Array.isArray(config?.responsiblePersons)
    ? config.responsiblePersons as ResponsiblePerson[]
    : []

  // Parse existing alert thresholds
  const alertThresholds: AlertThresholds = config?.alertThresholds
    ? (config.alertThresholds as AlertThresholds)
    : {}

  const handleUpdate = async (data: Parameters<typeof updateOversight.mutateAsync>[0]['data']): Promise<void> => {
    try {
      await updateOversight.mutateAsync({ systemId: system.id, data })
      toast.success('Oversight configuration updated')
    } catch {
      toast.error('Failed to update configuration')
    }
  }

  const handleAddPerson = async (): Promise<void> => {
    if (!newPerson.name || !newPerson.email || !newPerson.role) {
      toast.error('Please fill all fields')
      return
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newPerson.email)) {
      toast.error('Please enter a valid email address')
      return
    }
    // Check for duplicates
    if (responsiblePersons.some(p => p.email.toLowerCase() === newPerson.email.toLowerCase())) {
      toast.error('This email is already assigned')
      return
    }
    const updatedPersons = [...responsiblePersons, newPerson]
    await handleUpdate({ responsiblePersons: updatedPersons })
    setNewPerson({ name: '', email: '', role: '' })
    setPersonDialogOpen(false)
  }

  const handleRemovePerson = async (index: number): Promise<void> => {
    const updatedPersons = responsiblePersons.filter((_, i) => i !== index)
    await handleUpdate({ responsiblePersons: updatedPersons })
  }

  const handleThresholdChange = async (key: keyof AlertThresholds, value: number | undefined): Promise<void> => {
    const updated = { ...alertThresholds, [key]: value }
    await handleUpdate({ alertThresholds: updated })
  }

  // Training progress calculation
  const trainingSteps = [
    { done: config?.trainingRequired, label: 'Training Required' },
    { done: config?.procedureDocumented, label: 'Procedures Documented' },
    { done: config?.trainingCompleted, label: 'Training Completed' },
  ]
  const trainingProgress = trainingSteps.filter(s => s.done).length / trainingSteps.length

  return (
    <div className="space-y-6">
      {/* Training Progress Banner */}
      {system.riskLevel === 'HIGH' && (
        <div className={cn(
          'rounded-xl border p-5',
          trainingProgress === 1 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        )}>
          <div className="flex items-center gap-3">
            {trainingProgress === 1 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-700 shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {trainingProgress === 1 ? 'Training Complete' : 'Training Required for High-Risk System'}
                </span>
                <span className="text-sm text-black/50">
                  {Math.round(trainingProgress * 100)}%
                </span>
              </div>
              <div className="h-2.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    trainingProgress === 1 ? 'bg-green-500' : 'bg-yellow-500'
                  )}
                  style={{ width: `${trainingProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Oversight Level */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Human Oversight Configuration
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Oversight Level</Label>
            <Select
              value={config?.oversightLevel || 'monitoring'}
              onValueChange={(v) => handleUpdate({ oversightLevel: v as 'monitoring' | 'approval' | 'full_control' })}
              disabled={updateOversight.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monitoring">Monitoring Only</SelectItem>
                <SelectItem value="approval">Approval Required</SelectItem>
                <SelectItem value="full_control">Full Human Control</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-black/50 mt-1">
              {config?.oversightLevel === 'monitoring' && 'Humans monitor system outputs but don\'t approve each decision'}
              {config?.oversightLevel === 'approval' && 'Human approval required before system outputs are used'}
              {config?.oversightLevel === 'full_control' && 'Humans control all aspects of system operation'}
            </p>
          </div>

          <div>
            <Label>Monitoring Frequency</Label>
            <Select
              value={config?.monitoringFrequency || 'daily'}
              onValueChange={(v) => handleUpdate({ monitoringFrequency: v as 'real-time' | 'hourly' | 'daily' | 'weekly' })}
              disabled={updateOversight.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real-time">Real-time</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-black/50 mt-1">
              How often human reviewers check system performance
            </p>
          </div>
        </div>
      </div>

      {/* Responsible Persons */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Responsible Persons</h3>
          <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Person
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Responsible Person</DialogTitle>
                <DialogDescription>
                  Add a person responsible for human oversight of this AI system.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="person-name">Full Name</Label>
                  <Input
                    id="person-name"
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="person-email">Email</Label>
                  <Input
                    id="person-email"
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="person-role">Role</Label>
                  <Select
                    value={newPerson.role}
                    onValueChange={(v) => setNewPerson({ ...newPerson, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Oversight Lead">Oversight Lead</SelectItem>
                      <SelectItem value="Technical Reviewer">Technical Reviewer</SelectItem>
                      <SelectItem value="Compliance Officer">Compliance Officer</SelectItem>
                      <SelectItem value="Data Protection Officer">Data Protection Officer</SelectItem>
                      <SelectItem value="System Administrator">System Administrator</SelectItem>
                      <SelectItem value="Backup Contact">Backup Contact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddPerson} disabled={updateOversight.isPending}>
                  Add Person
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {responsiblePersons.length > 0 ? (
          <div className="space-y-2">
            {responsiblePersons.map((person, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-black/[0.02] rounded-xl hover:bg-black/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{person.name}</div>
                    <div className="text-xs text-black/50">{person.role} &middot; {person.email}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRemovePerson(index)}
                  aria-label={`Remove ${person.name}`}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-black/50">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No responsible persons assigned</p>
            <p className="text-xs">Add at least one person for compliance</p>
          </div>
        )}
      </div>

      {/* Alert Thresholds */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Alert Thresholds</h3>
        <p className="text-sm text-black/50 mb-4">
          Configure thresholds that trigger alerts for human review.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="threshold-error">Error Rate Threshold (%)</Label>
            <Input
              id="threshold-error"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={alertThresholds.errorRate ?? ''}
              onChange={(e) => handleThresholdChange('errorRate', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 5"
            />
            <p className="text-xs text-black/50 mt-1">Alert when error rate exceeds this</p>
          </div>
          <div>
            <Label htmlFor="threshold-latency">Latency Threshold (ms)</Label>
            <Input
              id="threshold-latency"
              type="number"
              min={0}
              step={100}
              value={alertThresholds.latencyMs ?? ''}
              onChange={(e) => handleThresholdChange('latencyMs', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 5000"
            />
            <p className="text-xs text-black/50 mt-1">Alert when response time exceeds this</p>
          </div>
          <div>
            <Label htmlFor="threshold-confidence">Min Confidence (%)</Label>
            <Input
              id="threshold-confidence"
              type="number"
              min={0}
              max={100}
              step={1}
              value={alertThresholds.confidenceMin ?? ''}
              onChange={(e) => handleThresholdChange('confidenceMin', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 80"
            />
            <p className="text-xs text-black/50 mt-1">Alert when confidence drops below</p>
          </div>
        </div>
      </div>

      {/* Human Roles */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Human Roles</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <CheckboxCard
            checked={config?.humanInLoop || false}
            onChange={(v) => handleUpdate({ humanInLoop: v })}
            label="Human-in-the-Loop"
            description="Human approval required for each decision"
          />
          <CheckboxCard
            checked={config?.humanOnLoop || false}
            onChange={(v) => handleUpdate({ humanOnLoop: v })}
            label="Human-on-the-Loop"
            description="Human monitors and can intervene"
          />
          <CheckboxCard
            checked={config?.humanInCommand || false}
            onChange={(v) => handleUpdate({ humanInCommand: v })}
            label="Human-in-Command"
            description="Human retains ultimate authority"
          />
        </div>
      </div>

      {/* Control Mechanisms */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Control Mechanisms</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <CheckboxCard
            checked={config?.canInterrupt || true}
            onChange={(v) => handleUpdate({ canInterrupt: v })}
            label="Can Interrupt"
            description="Humans can pause system operation"
          />
          <CheckboxCard
            checked={config?.canOverride || true}
            onChange={(v) => handleUpdate({ canOverride: v })}
            label="Can Override"
            description="Humans can override system decisions"
          />
          <CheckboxCard
            checked={config?.canShutdown || true}
            onChange={(v) => handleUpdate({ canShutdown: v })}
            label="Can Shutdown"
            description="Humans can stop the system entirely"
          />
        </div>
      </div>

      {/* Training Status */}
      <div className="bg-white rounded-2xl border border-black/10 p-6">
        <h3 className="font-medium mb-4">Training & Documentation</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <CheckboxCard
            checked={config?.trainingRequired || false}
            onChange={(v) => handleUpdate({ trainingRequired: v })}
            label="Training Required"
            description="Staff need training to operate"
          />
          <CheckboxCard
            checked={config?.trainingCompleted || false}
            onChange={(v) => handleUpdate({ trainingCompleted: v })}
            label="Training Completed"
            description="All required training is done"
          />
          <CheckboxCard
            checked={config?.procedureDocumented || false}
            onChange={(v) => handleUpdate({ procedureDocumented: v })}
            label="Procedure Documented"
            description="Oversight procedures are written"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Helper Components
// ============================================

function CheckboxCard({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}): React.JSX.Element {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'p-4 border rounded-xl text-left transition-all duration-200 hover:shadow-sm',
        checked ? 'border-primary bg-primary/5 shadow-sm' : 'border-black/10 hover:border-black/20'
      )}
    >
      <div className="flex items-center gap-3 mb-1.5">
        <div className={cn(
          'h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all',
          checked ? 'bg-primary border-primary' : 'border-black/20'
        )}>
          {checked && <Check className="h-3.5 w-3.5 text-white" />}
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className="text-xs text-black/50 ml-8">{description}</p>
    </button>
  )
}

function SystemDetailSkeleton(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="p-6">
        <Skeleton className="h-10 w-96 mb-6" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </main>
  )
}
