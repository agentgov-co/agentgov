'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-provider'
import { useProjects } from '@/hooks/use-projects'

const ONBOARDING_STORAGE_KEY = 'agentgov_onboarding_completed'
const ONBOARDING_SKIPPED_KEY = 'agentgov_onboarding_skipped'

export type OnboardingStep = 'organization' | 'project' | 'api-key'

interface OnboardingState {
  /** null = auto, true = manually opened, false = manually closed */
  manuallyOpened: boolean | null
  /** Onboarding flow has started and should stay open until complete/skip */
  inProgress: boolean
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  createdProjectApiKey: string | null
}

interface UseOnboardingReturn {
  shouldShow: boolean
  isOpen: boolean
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  createdProjectApiKey: string | null
  open: () => void
  close: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: OnboardingStep) => void
  completeStep: (step: OnboardingStep) => void
  setCreatedProjectApiKey: (key: string) => void
  skip: () => void
  complete: () => void
  reset: () => void
  steps: OnboardingStep[]
  currentStepIndex: number
  totalSteps: number
  hasOrganization: boolean
  hasProjects: boolean
}

const STEP_ORDER: OnboardingStep[] = ['organization', 'project', 'api-key']

function getStorageValue(key: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(key) === 'true'
}

function setStorageValue(key: string, value: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value)
  }
}

function removeStorageValue(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key)
  }
}

export function useOnboarding(): UseOnboardingReturn {
  const { organization, isAuthenticated, isOrgLoading } = useAuth()
  const { data: projects, isLoading: isProjectsLoading } = useProjects()

  const hasOrganization = !!organization
  const hasProjects = !!projects && projects.length > 0

  // Determine if onboarding should auto-show (initial trigger)
  const shouldShow = useMemo(() => {
    if (!isAuthenticated || isOrgLoading || isProjectsLoading) {
      return false
    }

    if (getStorageValue(ONBOARDING_STORAGE_KEY) || getStorageValue(ONBOARDING_SKIPPED_KEY)) {
      return false
    }

    return !hasOrganization || !hasProjects
  }, [isAuthenticated, isOrgLoading, isProjectsLoading, hasOrganization, hasProjects])

  const [state, setState] = useState<OnboardingState>(() => ({
    manuallyOpened: null,
    inProgress: false,
    currentStep: 'organization',
    completedSteps: [],
    createdProjectApiKey: null,
  }))

  // Compute current step - auto-advance if org already exists
  const currentStep = useMemo((): OnboardingStep => {
    if (hasOrganization && state.currentStep === 'organization') {
      return 'project'
    }
    return state.currentStep
  }, [hasOrganization, state.currentStep])

  // Compute completed steps - include org if it exists
  const completedSteps = useMemo((): OnboardingStep[] => {
    const steps = [...state.completedSteps]
    if (hasOrganization && !steps.includes('organization')) {
      return [...steps, 'organization']
    }
    return steps
  }, [state.completedSteps, hasOrganization])

  // isOpen logic:
  // 1. If manually closed (false) -> closed
  // 2. If in progress -> open (stays open until complete/skip)
  // 3. If manually opened (true) -> open
  // 4. Otherwise use shouldShow for initial auto-open
  const isOpen = useMemo(() => {
    // Manually closed takes priority
    if (state.manuallyOpened === false) {
      return false
    }
    // If in progress, stay open
    if (state.inProgress) {
      return true
    }
    // Manually opened
    if (state.manuallyOpened === true) {
      return true
    }
    // Auto-open based on shouldShow
    return shouldShow
  }, [state.manuallyOpened, state.inProgress, shouldShow])

  // When modal becomes visible, mark as in progress
  const open = useCallback(() => {
    setState(prev => ({ ...prev, manuallyOpened: true, inProgress: true }))
  }, [])

  const close = useCallback(() => {
    setState(prev => ({ ...prev, manuallyOpened: false, inProgress: false }))
  }, [])

  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step, inProgress: true }))
  }, [])

  const nextStep = useCallback(() => {
    setState(prev => {
      const effectiveStep = hasOrganization && prev.currentStep === 'organization'
        ? 'project'
        : prev.currentStep
      const currentIndex = STEP_ORDER.indexOf(effectiveStep)
      const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1)
      return { ...prev, currentStep: STEP_ORDER[nextIndex], inProgress: true }
    })
  }, [hasOrganization])

  const prevStep = useCallback(() => {
    setState(prev => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep)
      const prevIndex = Math.max(currentIndex - 1, 0)
      return { ...prev, currentStep: STEP_ORDER[prevIndex] }
    })
  }, [])

  const completeStep = useCallback((step: OnboardingStep) => {
    setState(prev => {
      if (prev.completedSteps.includes(step)) {
        return { ...prev, inProgress: true }
      }
      return {
        ...prev,
        completedSteps: [...prev.completedSteps, step],
        inProgress: true,
      }
    })
  }, [])

  const setCreatedProjectApiKey = useCallback((key: string) => {
    setState(prev => ({ ...prev, createdProjectApiKey: key, inProgress: true }))
  }, [])

  const skip = useCallback(() => {
    setStorageValue(ONBOARDING_SKIPPED_KEY, 'true')
    setState(prev => ({ ...prev, manuallyOpened: false, inProgress: false }))
  }, [])

  const complete = useCallback(() => {
    setStorageValue(ONBOARDING_STORAGE_KEY, 'true')
    setState(prev => ({ ...prev, manuallyOpened: false, inProgress: false }))
  }, [])

  const reset = useCallback(() => {
    removeStorageValue(ONBOARDING_STORAGE_KEY)
    removeStorageValue(ONBOARDING_SKIPPED_KEY)
    setState({
      manuallyOpened: null,
      inProgress: false,
      currentStep: 'organization',
      completedSteps: [],
      createdProjectApiKey: null,
    })
  }, [])

  // Mark as in progress when shouldShow triggers auto-open
  // This ensures the modal stays open even when org/projects are created
  const effectiveInProgress = state.inProgress || (shouldShow && state.manuallyOpened === null)

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  return {
    shouldShow,
    isOpen: effectiveInProgress ? (state.manuallyOpened !== false) : isOpen,
    currentStep,
    completedSteps,
    createdProjectApiKey: state.createdProjectApiKey,
    open,
    close,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    setCreatedProjectApiKey,
    skip,
    complete,
    reset,
    steps: STEP_ORDER,
    currentStepIndex,
    totalSteps: STEP_ORDER.length,
    hasOrganization,
    hasProjects,
  }
}
