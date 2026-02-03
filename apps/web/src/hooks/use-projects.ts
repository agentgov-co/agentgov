'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { projectsApi, type Project, type CreateProjectInput } from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export function useProjects(): UseQueryResult<Project[]> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: [...projectKeys.list(), organization?.id],
    queryFn: () => projectsApi.list(),
    enabled: isAuthenticated && !!organization,
  })
}

export function useProject(id: string): UseQueryResult<Project> {
  const { isAuthenticated, organization } = useAuth()

  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.get(id),
    enabled: !!id && isAuthenticated && !!organization,
  })
}

export function useCreateProject(): UseMutationResult<Project, Error, CreateProjectInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list() })
    },
  })
}

export function useDeleteProject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list() })
    },
  })
}
