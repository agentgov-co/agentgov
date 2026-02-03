'use client'

import { createContext, useContext } from 'react'

interface SelectedProjectContextValue {
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
}

export const SelectedProjectContext = createContext<SelectedProjectContextValue | null>(null)

export function useSelectedProject(): SelectedProjectContextValue {
  const context = useContext(SelectedProjectContext)
  if (!context) {
    throw new Error('useSelectedProject must be used within SelectedProjectProvider')
  }
  return context
}
