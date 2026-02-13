'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useOnboarding, type OnboardingStep } from '@/hooks/use-onboarding'
import { CreateOrgStep, CreateProjectStep, ApiKeyStep } from './steps'
import { cn } from '@/lib/utils'

const STEP_TITLES: Record<OnboardingStep, string> = {
  organization: 'Set Up Your Workspace',
  project: 'Create Your First Project',
  'api-key': 'Get Started',
}

const STEP_DESCRIPTIONS: Record<OnboardingStep, string> = {
  organization: 'Step 1 of 3',
  project: 'Step 2 of 3',
  'api-key': 'Step 3 of 3',
}

export function OnboardingModal(): React.JSX.Element | null {
  const {
    isOpen,
    currentStep,
    currentStepIndex,
    steps,
    completedSteps,
    createdProjectApiKey,
    nextStep,
    prevStep,
    completeStep,
    setCreatedProjectApiKey,
    skip,
    complete,
    hasOrganization,
  } = useOnboarding()

  // Handle organization creation complete
  const handleOrgComplete = useCallback(() => {
    completeStep('organization')
    nextStep()
  }, [completeStep, nextStep])

  // Handle project creation complete
  const handleProjectComplete = useCallback((apiKey: string) => {
    setCreatedProjectApiKey(apiKey)
    completeStep('project')
    nextStep()
  }, [completeStep, nextStep, setCreatedProjectApiKey])

  // Handle final completion
  const handleComplete = useCallback(() => {
    completeStep('api-key')
    complete()
  }, [completeStep, complete])

  // Render current step content
  const renderStepContent = (): React.ReactNode => {
    switch (currentStep) {
      case 'organization':
        return (
          <CreateOrgStep
            onComplete={handleOrgComplete}
            onSkip={skip}
          />
        )
      case 'project':
        return (
          <CreateProjectStep
            onComplete={handleProjectComplete}
            onBack={hasOrganization ? undefined : prevStep}
            onSkip={skip}
          />
        )
      case 'api-key':
        return (
          <ApiKeyStep
            apiKey={createdProjectApiKey || ''}
            onComplete={handleComplete}
            onBack={prevStep}
          />
        )
      default:
        return null
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && skip()}>
      <DialogContent
        className="sm:max-w-[480px] gap-0 p-0 max-h-[90vh] flex flex-col"
        showCloseButton={currentStep !== 'api-key'}
      >
        {/* Header with progress */}
        <DialogHeader className="p-6 pb-0">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step)
              const isCurrent = currentStepIndex === index
              return (
                <div
                  key={step}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    isCurrent ? 'w-8 bg-primary' : 'w-2',
                    isCompleted && !isCurrent && 'bg-primary/60',
                    !isCompleted && !isCurrent && 'bg-muted'
                  )}
                />
              )
            })}
          </div>

          <DialogTitle className="text-center">
            {STEP_TITLES[currentStep]}
          </DialogTitle>
          <DialogDescription className="text-center">
            {STEP_DESCRIPTIONS[currentStep]}
          </DialogDescription>
        </DialogHeader>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
