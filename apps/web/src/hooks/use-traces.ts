'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { tracesApi, type Trace, type TracesResponse, type TracesQuery } from '@/lib/api'

export const traceKeys = {
  all: ['traces'] as const,
  lists: () => [...traceKeys.all, 'list'] as const,
  list: (query: TracesQuery) => [...traceKeys.lists(), query] as const,
  details: () => [...traceKeys.all, 'detail'] as const,
  detail: (id: string) => [...traceKeys.details(), id] as const,
}

export function useTraces(query: TracesQuery): UseQueryResult<TracesResponse> {
  return useQuery({
    queryKey: traceKeys.list(query),
    queryFn: () => tracesApi.list(query),
    enabled: !!query.projectId,
    staleTime: 30 * 1000, // 30 seconds — traces change frequently
    placeholderData: keepPreviousData,
  })
}

export function useTrace(id: string, projectId?: string): UseQueryResult<Trace> {
  return useQuery({
    queryKey: traceKeys.detail(id),
    queryFn: () => tracesApi.get(id, projectId),
    enabled: !!id,
  })
}

export function useDeleteTrace(projectId: string): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tracesApi.delete(id, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: traceKeys.lists() })
    },
  })
}
