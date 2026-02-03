'use client'

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'

// React state-based key management — keys are held in memory only,
// never persisted to sessionStorage or localStorage

interface ApiKeyContextValue {
  projectApiKey: string
  setProjectApiKey: (key: string) => void
}

export const ApiKeyContext = createContext<ApiKeyContextValue | null>(null)

export function ApiKeyProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [projectApiKey, setProjectApiKey] = useState('')
  return (
    <ApiKeyContext.Provider value={{ projectApiKey, setProjectApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useProjectApiKeyState(): [string, (key: string) => void] {
  const ctx = useContext(ApiKeyContext)
  // Fallback to local state if provider not mounted (backwards compat)
  const [localKey, setLocalKey] = useState('')

  if (ctx) {
    return [ctx.projectApiKey, ctx.setProjectApiKey]
  }
  return [localKey, setLocalKey]
}

export function useProjectApiKey(): string {
  const [key] = useProjectApiKeyState()
  return key
}

export function useAdminKey(): string {
  // Admin key is no longer stored — return empty
  return ''
}

export function useAdminKeyState(): [string, (key: string) => void] {
  const [key, setKey] = useState('')
  return [key, useCallback((k: string) => setKey(k), [])]
}
