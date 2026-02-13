'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import {
  complianceApi,
  type AISystemsQuery,
  type IncidentsQuery,
  type AssessmentWizardData,
  type UpdateObligationInput,
  type CreateIncidentInput,
  type UpdateIncidentInput,
  type UpdateOversightInput,
  type DocumentType,
  type ComplianceStatus,
  type AISystem,
  type AISystemsResponse,
  type AssessmentResult,
  type ComplianceStats,
  type ComplianceDocument,
  type ComplianceObligation,
  type IncidentReport,
  type HumanOversightConfig,
} from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'

// ============================================
// Query Keys
// ============================================

export const complianceKeys = {
  all: ['compliance'] as const,
  systems: () => [...complianceKeys.all, 'systems'] as const,
  systemsList: (query: AISystemsQuery) => [...complianceKeys.systems(), 'list', query] as const,
  systemDetail: (id: string) => [...complianceKeys.systems(), 'detail', id] as const,
  stats: (projectId?: string) => [...complianceKeys.all, 'stats', projectId] as const,
  documents: () => [...complianceKeys.all, 'documents'] as const,
  documentsList: (query: { aiSystemId?: string; type?: DocumentType }) => [...complianceKeys.documents(), 'list', query] as const,
  documentDetail: (id: string) => [...complianceKeys.documents(), 'detail', id] as const,
  incidents: () => [...complianceKeys.all, 'incidents'] as const,
  incidentsList: (query: IncidentsQuery) => [...complianceKeys.incidents(), 'list', query] as const,
}

// ============================================
// AI Systems Hooks
// ============================================

export function useComplianceSystems(query: AISystemsQuery = {}): UseQueryResult<AISystemsResponse> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...complianceKeys.systemsList(query), organization?.id],
    queryFn: () => complianceApi.listSystems(query),
    enabled: isAuthenticated && !!organization,
    placeholderData: keepPreviousData,
  })
}

export function useComplianceSystem(id: string): UseQueryResult<AISystem> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: complianceKeys.systemDetail(id),
    queryFn: () => complianceApi.getSystem(id),
    enabled: !!id && isAuthenticated && !!organization,
    staleTime: 3 * 60 * 1000, // 3 minutes — detail data changes infrequently
  })
}

export function useUpdateSystem(): UseMutationResult<AISystem, Error, { id: string; data: { name?: string; description?: string; version?: string; complianceStatus?: ComplianceStatus } }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; version?: string; complianceStatus?: ComplianceStatus } }) =>
      complianceApi.updateSystem(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.systems() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.systemDetail(variables.id) })
    },
  })
}

export function useDeleteSystem(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => complianceApi.deleteSystem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.systems() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() })
    },
  })
}

// ============================================
// Assessment Hook
// ============================================

export function useSubmitAssessment(): UseMutationResult<AssessmentResult, Error, AssessmentWizardData> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AssessmentWizardData) => complianceApi.submitAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.systems() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() })
    },
  })
}

// ============================================
// Stats Hook
// ============================================

export function useComplianceStats(projectId?: string): UseQueryResult<ComplianceStats> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...complianceKeys.stats(projectId), organization?.id],
    queryFn: () => complianceApi.getStats(projectId),
    enabled: isAuthenticated && !!organization,
    staleTime: 2 * 60 * 1000, // 2 minutes — stats change rarely
  })
}

// ============================================
// Obligations Hook
// ============================================

export function useUpdateObligation(): UseMutationResult<ComplianceObligation, Error, { id: string; data: UpdateObligationInput }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateObligationInput }) =>
      complianceApi.updateObligation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.systems() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() })
    },
  })
}

// ============================================
// Documents Hooks
// ============================================

export function useComplianceDocuments(query: { aiSystemId?: string; type?: DocumentType } = {}): UseQueryResult<{ data: ComplianceDocument[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...complianceKeys.documentsList(query), organization?.id],
    queryFn: () => complianceApi.listDocuments(query),
    enabled: isAuthenticated && !!organization,
  })
}

export function useComplianceDocument(id: string): UseQueryResult<ComplianceDocument> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: complianceKeys.documentDetail(id),
    queryFn: () => complianceApi.getDocument(id),
    enabled: !!id && isAuthenticated && !!organization,
  })
}

export function useGenerateDocument(): UseMutationResult<ComplianceDocument, Error, { aiSystemId: string; type: DocumentType }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ aiSystemId, type }: { aiSystemId: string; type: DocumentType }) =>
      complianceApi.generateDocument(aiSystemId, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.documents() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.systemDetail(variables.aiSystemId) })
    },
  })
}

// ============================================
// Incidents Hooks
// ============================================

export function useComplianceIncidents(query: IncidentsQuery = {}): UseQueryResult<{ data: IncidentReport[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...complianceKeys.incidentsList(query), organization?.id],
    queryFn: () => complianceApi.listIncidents(query),
    enabled: isAuthenticated && !!organization,
  })
}

export function useCreateIncident(): UseMutationResult<IncidentReport, Error, CreateIncidentInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIncidentInput) => complianceApi.createIncident(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.incidents() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.systemDetail(variables.aiSystemId) })
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() })
    },
  })
}

export function useUpdateIncident(): UseMutationResult<IncidentReport, Error, { id: string; data: UpdateIncidentInput }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncidentInput }) =>
      complianceApi.updateIncident(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.incidents() })
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() })
    },
  })
}

// ============================================
// Oversight Hook
// ============================================

export function useUpdateOversight(): UseMutationResult<HumanOversightConfig, Error, { systemId: string; data: UpdateOversightInput }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ systemId, data }: { systemId: string; data: UpdateOversightInput }) =>
      complianceApi.updateOversight(systemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.systemDetail(variables.systemId) })
    },
  })
}
