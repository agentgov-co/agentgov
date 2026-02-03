const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

// Map HTTP status codes to user-friendly messages
export const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Please sign in to continue.',
  403: 'Access denied.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred. Please try again.',
  422: 'Invalid data. Please check your input.',
  429: 'Too many requests. Please wait and try again.',
  500: 'Something went wrong. Please try again later.',
  502: 'Service temporarily unavailable. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
}

/** Sanitize an error message from the API to prevent leaking internal details */
export function sanitizeApiError(status: number, serverMessage?: string): string {
  // For 5xx errors, always use generic message
  if (status >= 500) {
    return STATUS_MESSAGES[status] ?? 'Something went wrong. Please try again later.'
  }

  // For 4xx, use server message if it looks safe, otherwise use mapped message
  if (serverMessage) {
    const hasSensitiveContent =
      /\.(ts|js|mjs):\d+/.test(serverMessage) ||
      /at\s+\w+\s*\(/.test(serverMessage) ||
      /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(serverMessage) ||
      /prisma\.\w+/i.test(serverMessage)

    if (!hasSensitiveContent) {
      return serverMessage
    }
  }

  return STATUS_MESSAGES[status] ?? `Request failed (${status}).`
}

// ============================================
// Authenticated API (uses session cookies)
// ============================================

async function fetchAuthApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include', // Send cookies for session auth
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(sanitizeApiError(response.status, error.message || error.error))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// ============================================
// Projects API
// ============================================

export interface Project {
  id: string
  name: string
  description: string | null
  apiKey?: string  // Only on creation
  createdAt: string
  updatedAt: string
  _count?: { traces: number }
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export const projectsApi = {
  list: () => fetchAuthApi<Project[]>('/v1/projects'),

  get: (id: string) => fetchAuthApi<Project>(`/v1/projects/${id}`),

  create: (data: CreateProjectInput) =>
    fetchAuthApi<Project>('/v1/projects', {
      method: 'POST',
      body: data,
    }),

  delete: (id: string) =>
    fetchAuthApi<void>(`/v1/projects/${id}`, {
      method: 'DELETE',
    })
}

// ============================================
// Traces API
// ============================================

export type TraceStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface Trace {
  id: string
  projectId: string
  name: string | null
  status: TraceStatus
  startedAt: string
  endedAt: string | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  totalCost: number | null
  totalTokens: number | null
  totalDuration: number | null
  _count?: { spans: number }
  spans?: Span[]
}

export interface TracesResponse {
  data: Trace[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface TracesQuery {
  projectId: string
  status?: TraceStatus
  search?: string
  limit?: number
  offset?: number
}

export const tracesApi = {
  list: (query: TracesQuery) => {
    const params = new URLSearchParams()
    params.set('projectId', query.projectId)
    if (query.status) params.set('status', query.status)
    if (query.search) params.set('search', query.search)
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))

    return fetchAuthApi<TracesResponse>(`/v1/traces?${params}`)
  },

  get: (id: string, projectId?: string) => {
    const params = projectId ? `?projectId=${projectId}` : ''
    return fetchAuthApi<Trace>(`/v1/traces/${id}${params}`)
  },

  delete: (id: string, projectId: string) =>
    fetchAuthApi<void>(`/v1/traces/${id}?projectId=${projectId}`, {
      method: 'DELETE',
    })
}

// ============================================
// Spans API
// ============================================

export type SpanType =
  | 'LLM_CALL'
  | 'TOOL_CALL'
  | 'AGENT_STEP'
  | 'RETRIEVAL'
  | 'EMBEDDING'
  | 'CUSTOM'

export type SpanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface Span {
  id: string
  traceId: string
  parentId: string | null
  name: string
  type: SpanType
  status: SpanStatus
  startedAt: string
  endedAt: string | null
  duration: number | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  error: string | null
  model: string | null
  promptTokens: number | null
  outputTokens: number | null
  cost: number | null
  toolName: string | null
  children?: Span[]
}

export const spansApi = {
  get: (id: string, projectId: string) =>
    fetchAuthApi<Span>(`/v1/spans/${id}?projectId=${projectId}`)
}

// ============================================
// API Keys API (authenticated)
// ============================================

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  projectId: string | null
  permissions: string[]
  rateLimit: number
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  key?: string // Only returned on creation
  project?: {
    id: string
    name: string
  } | null
}

export interface CreateApiKeyInput {
  name: string
  projectId?: string
  expiresInDays?: number
}

export interface UpdateApiKeyInput {
  name?: string
  rateLimit?: number
}

export const apiKeysApi = {
  list: () => fetchAuthApi<{ data: ApiKey[] }>('/v1/api-keys'),

  get: (id: string) => fetchAuthApi<ApiKey>(`/v1/api-keys/${id}`),

  create: (data: CreateApiKeyInput) =>
    fetchAuthApi<ApiKey & { key: string; message: string }>('/v1/api-keys', {
      method: 'POST',
      body: data,
    }),

  update: (id: string, data: UpdateApiKeyInput) =>
    fetchAuthApi<ApiKey>(`/v1/api-keys/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  delete: (id: string) =>
    fetchAuthApi<void>(`/v1/api-keys/${id}`, {
      method: 'DELETE',
    }),
}

// ============================================
// Usage API
// ============================================

export type PlanTier = 'FREE_BETA' | 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING'

export interface UsageData {
  // Current usage
  tracesCount: number
  projectsCount: number
  membersCount: number

  // Limits from plan
  tracesLimit: number
  projectsLimit: number
  membersLimit: number
  retentionDays: number

  // Plan info
  tier: PlanTier
  status: SubscriptionStatus
  billingEnabled: boolean

  // Period
  periodStart: string
  periodEnd: string

  // Percentages
  tracesPercentage: number
  projectsPercentage: number
  membersPercentage: number
}

export const usageApi = {
  get: () => fetchAuthApi<UsageData>('/v1/usage'),
}

// ============================================
// Billing API
// ============================================

export interface BillingStatus {
  billingEnabled: boolean
}

export interface CheckoutSession {
  checkoutUrl: string
}

export interface PortalSession {
  portalUrl: string
}

export interface CreateCheckoutInput {
  tier: 'STARTER' | 'PRO' | 'ENTERPRISE'
  successUrl: string
  cancelUrl: string
}

export interface CreatePortalInput {
  returnUrl: string
}

export const billingApi = {
  /** Get billing status (whether billing is enabled) */
  getStatus: () => fetchAuthApi<BillingStatus>('/v1/billing/status'),

  /** Create Stripe checkout session for plan upgrade */
  createCheckout: (data: CreateCheckoutInput) =>
    fetchAuthApi<CheckoutSession>('/v1/billing/checkout', {
      method: 'POST',
      body: data,
    }),

  /** Create Stripe billing portal session */
  createPortal: (data: CreatePortalInput) =>
    fetchAuthApi<PortalSession>('/v1/billing/portal', {
      method: 'POST',
      body: data,
    }),
}

// ============================================
// EU AI Act Compliance API
// ============================================

export type RiskLevel = 'PROHIBITED' | 'HIGH' | 'LIMITED' | 'MINIMAL' | 'UNKNOWN'
export type ComplianceStatus = 'NOT_ASSESSED' | 'IN_PROGRESS' | 'COMPLIANT' | 'NON_COMPLIANT' | 'EXEMPT'
export type ObligationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE'
export type DocumentType =
  | 'TECHNICAL_DOCUMENTATION'
  | 'RISK_MANAGEMENT'
  | 'DATA_GOVERNANCE'
  | 'HUMAN_OVERSIGHT'
  | 'CONFORMITY_DECLARATION'
  | 'FRIA'
  | 'TRANSPARENCY_NOTICE'
  | 'INCIDENT_REPORT'
  | 'POST_MARKET_MONITORING'
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IncidentType = 'SAFETY' | 'FUNDAMENTAL_RIGHTS' | 'MALFUNCTION' | 'MISUSE' | 'SECURITY' | 'OTHER'
export type AnnexIIICategory =
  | 'biometrics'
  | 'critical_infrastructure'
  | 'education'
  | 'employment'
  | 'essential_services'
  | 'law_enforcement'
  | 'migration'
  | 'justice'

export interface AISystem {
  id: string
  name: string
  description: string | null
  version: string | null
  riskLevel: RiskLevel
  complianceStatus: ComplianceStatus
  annexIIICategory: string | null
  prohibitedReason: string | null
  wizardData: Record<string, unknown> | null
  deployedInEU: boolean
  affectsEUCitizens: boolean
  intendedPurpose: string | null
  intendedUsers: string | null
  riskReasoning: string | null
  applicableArticles: string[]
  projectId: string
  createdAt: string
  updatedAt: string
  assessedAt: string | null
  project?: { id: string; name: string }
  obligations?: ComplianceObligation[]
  documents?: ComplianceDocument[]
  incidents?: IncidentReport[]
  oversightConfig?: HumanOversightConfig | null
  traces?: {
    id: string
    name: string | null
    status: TraceStatus
    startedAt: string
    endedAt: string | null
    totalCost: number | null
    totalTokens: number | null
    totalDuration: number | null
  }[]
  _count?: {
    obligations: number
    documents: number
    incidents: number
    traces?: number
  }
}

export interface ComplianceObligation {
  id: string
  articleNumber: string
  articleTitle: string
  description: string
  status: ObligationStatus
  notes: string | null
  completedAt: string | null
  deadline: string | null
  aiSystemId: string
  createdAt: string
  updatedAt: string
}

export interface ComplianceDocument {
  id: string
  type: DocumentType
  title: string
  content: string
  version: number
  generatedFrom: Record<string, unknown> | null
  aiSystemId: string
  createdAt: string
  updatedAt: string
  aiSystem?: { id: string; name: string }
}

export interface IncidentReport {
  id: string
  title: string
  description: string
  severity: IncidentSeverity
  type: IncidentType
  occurredAt: string
  detectedAt: string
  resolvedAt: string | null
  impactDescription: string | null
  affectedUsers: number | null
  rootCause: string | null
  remediationSteps: string | null
  preventiveMeasures: string | null
  reportedToAuthority: boolean
  reportedAt: string | null
  aiSystemId: string
  createdAt: string
  updatedAt: string
  aiSystem?: { id: string; name: string }
}

export interface HumanOversightConfig {
  id: string
  oversightLevel: string
  humanInLoop: boolean
  humanOnLoop: boolean
  humanInCommand: boolean
  canInterrupt: boolean
  canOverride: boolean
  canShutdown: boolean
  monitoringFrequency: string | null
  alertThresholds: Record<string, unknown> | null
  responsiblePersons: Array<{ name: string; email: string; role: string }> | null
  trainingRequired: boolean
  trainingCompleted: boolean
  procedureDocumented: boolean
  aiSystemId: string
  createdAt: string
  updatedAt: string
}

export interface AssessmentWizardData {
  // Step 1
  name: string
  description?: string
  version?: string
  projectId: string
  // Step 2
  useCaseDescription: string
  annexIIICategory: AnnexIIICategory | null
  usesBiometricIdentification?: boolean
  usesSocialScoring?: boolean
  usesEmotionRecognition?: boolean
  usesPredictivePolicing?: boolean
  usesSubliminalManipulation?: boolean
  exploitsVulnerabilities?: boolean
  // Step 3
  deployedInEU: boolean
  affectsEUCitizens: boolean
  intendedPurpose: string
  intendedUsers?: string
  deploymentScale?: 'prototype' | 'limited' | 'wide' | 'mass'
  automationLevel?: 'fully_automated' | 'semi_automated' | 'human_assisted'
  // Step 4
  processesPersonalData: boolean
  processesSensitiveData?: boolean
  usesProfilingOrScoring?: boolean
  hasLegalEffects?: boolean
  hasSafetyImpact?: boolean
  affectsVulnerableGroups?: boolean
  dataCategories?: string[]
  // Step 5: FRIA
  friaAffectedGroups?: string
  friaPotentialDiscrimination?: string
  friaFundamentalRightsImpact?: string
  friaMitigationMeasures?: string
}

export interface AssessmentResult {
  system: AISystem
  classification: {
    riskLevel: RiskLevel
    reasoning: string[]
    applicableArticles: string[]
    prohibitedReason?: string
  }
}

export interface AISystemsResponse {
  data: AISystem[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface ComplianceStats {
  totalSystems: number
  byRiskLevel: Record<RiskLevel, number>
  byComplianceStatus: Record<ComplianceStatus, number>
  pendingObligations: number
  recentIncidents: IncidentReport[]
}

export interface AISystemsQuery {
  projectId?: string
  riskLevel?: RiskLevel
  complianceStatus?: ComplianceStatus
  limit?: number
  offset?: number
}

export interface IncidentsQuery {
  aiSystemId?: string
  severity?: IncidentSeverity
  type?: IncidentType
  resolved?: boolean
  limit?: number
  offset?: number
}

export interface CreateIncidentInput {
  aiSystemId: string
  title: string
  description: string
  severity: IncidentSeverity
  type: IncidentType
  occurredAt: Date | string
  detectedAt: Date | string
  impactDescription?: string
  affectedUsers?: number
}

export interface UpdateIncidentInput {
  title?: string
  description?: string
  severity?: IncidentSeverity
  resolvedAt?: Date | string
  rootCause?: string
  remediationSteps?: string
  preventiveMeasures?: string
  reportedToAuthority?: boolean
  reportedAt?: Date | string
}

export interface UpdateObligationInput {
  status: ObligationStatus
  notes?: string
}

export interface UpdateOversightInput {
  oversightLevel?: 'monitoring' | 'approval' | 'full_control'
  humanInLoop?: boolean
  humanOnLoop?: boolean
  humanInCommand?: boolean
  canInterrupt?: boolean
  canOverride?: boolean
  canShutdown?: boolean
  monitoringFrequency?: 'real-time' | 'hourly' | 'daily' | 'weekly'
  alertThresholds?: Record<string, unknown>
  responsiblePersons?: Array<{ name: string; email: string; role: string }>
  trainingRequired?: boolean
  trainingCompleted?: boolean
  procedureDocumented?: boolean
}

export const complianceApi = {
  // Assessment
  submitAssessment: (data: AssessmentWizardData) =>
    fetchAuthApi<AssessmentResult>('/v1/compliance/assess', {
      method: 'POST',
      body: data,
    }),

  // AI Systems
  listSystems: (query: AISystemsQuery = {}) => {
    const params = new URLSearchParams()
    if (query.projectId) params.set('projectId', query.projectId)
    if (query.riskLevel) params.set('riskLevel', query.riskLevel)
    if (query.complianceStatus) params.set('complianceStatus', query.complianceStatus)
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))
    return fetchAuthApi<AISystemsResponse>(`/v1/compliance/systems?${params}`)
  },

  getSystem: (id: string) =>
    fetchAuthApi<AISystem>(`/v1/compliance/systems/${id}`),

  getSystemTraces: (id: string, query: { limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))
    return fetchAuthApi<TracesResponse>(`/v1/compliance/systems/${id}/traces?${params}`)
  },

  updateSystem: (id: string, data: { name?: string; description?: string; version?: string; complianceStatus?: ComplianceStatus }) =>
    fetchAuthApi<AISystem>(`/v1/compliance/systems/${id}`, {
      method: 'PUT',
      body: data,
    }),

  deleteSystem: (id: string) =>
    fetchAuthApi<void>(`/v1/compliance/systems/${id}`, {
      method: 'DELETE',
    }),

  // Obligations
  updateObligation: (id: string, data: UpdateObligationInput) =>
    fetchAuthApi<ComplianceObligation>(`/v1/compliance/obligations/${id}`, {
      method: 'PUT',
      body: data,
    }),

  // Documents
  generateDocument: (aiSystemId: string, type: DocumentType) =>
    fetchAuthApi<ComplianceDocument>('/v1/compliance/documents/generate', {
      method: 'POST',
      body: { aiSystemId, type },
    }),

  listDocuments: (query: { aiSystemId?: string; type?: DocumentType; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.aiSystemId) params.set('aiSystemId', query.aiSystemId)
    if (query.type) params.set('type', query.type)
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))
    return fetchAuthApi<{ data: ComplianceDocument[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/v1/compliance/documents?${params}`)
  },

  getDocument: (id: string) =>
    fetchAuthApi<ComplianceDocument>(`/v1/compliance/documents/${id}`),

  // Incidents
  createIncident: (data: CreateIncidentInput) =>
    fetchAuthApi<IncidentReport>('/v1/compliance/incidents', {
      method: 'POST',
      body: data,
    }),

  listIncidents: (query: IncidentsQuery = {}) => {
    const params = new URLSearchParams()
    if (query.aiSystemId) params.set('aiSystemId', query.aiSystemId)
    if (query.severity) params.set('severity', query.severity)
    if (query.type) params.set('type', query.type)
    if (query.resolved !== undefined) params.set('resolved', String(query.resolved))
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))
    return fetchAuthApi<{ data: IncidentReport[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/v1/compliance/incidents?${params}`)
  },

  updateIncident: (id: string, data: UpdateIncidentInput) =>
    fetchAuthApi<IncidentReport>(`/v1/compliance/incidents/${id}`, {
      method: 'PUT',
      body: data,
    }),

  // Oversight
  updateOversight: (systemId: string, data: UpdateOversightInput) =>
    fetchAuthApi<HumanOversightConfig>(`/v1/compliance/systems/${systemId}/oversight`, {
      method: 'PUT',
      body: data,
    }),

  // Stats
  getStats: (projectId?: string) => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    return fetchAuthApi<ComplianceStats>(`/v1/compliance/stats?${params}`)
  },
}
