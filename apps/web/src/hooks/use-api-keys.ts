'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { apiKeysApi, type ApiKey, type CreateApiKeyInput, type UpdateApiKeyInput } from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
  detail: (id: string) => [...apiKeyKeys.all, 'detail', id] as const,
}

export function useApiKeys(): UseQueryResult<ApiKey[]> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...apiKeyKeys.list(), organization?.id],
    queryFn: async () => {
      const response = await apiKeysApi.list()
      return response.data
    },
    enabled: isAuthenticated && !!organization,
  })
}

export function useApiKey(id: string): UseQueryResult<ApiKey> {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: apiKeyKeys.detail(id),
    queryFn: () => apiKeysApi.get(id),
    enabled: isAuthenticated && !!id,
  })
}

export function useCreateApiKey(): UseMutationResult<ApiKey & { key: string; message: string }, Error, CreateApiKeyInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateApiKeyInput) => apiKeysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() })
    },
  })
}

export function useUpdateApiKey(): UseMutationResult<ApiKey, Error, { id: string; data: UpdateApiKeyInput }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyInput }) =>
      apiKeysApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() })
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.detail(id) })
    },
  })
}

export function useDeleteApiKey(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() })
    },
  })
}
