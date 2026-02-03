'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/use-projects'
import { useSubmitAssessment } from '@/hooks/use-compliance'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertOctagon,
  Info,
  FileText,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssessmentWizardData, RiskLevel, AnnexIIICategory } from '@/lib/api'

const STEPS = [
  { number: 1, title: 'Basic Info', description: 'System identification' },
  { number: 2, title: 'Use Case', description: 'Annex III categories' },
  { number: 3, title: 'Deployment', description: 'Context and scale' },
  { number: 4, title: 'Data & Impact', description: 'Data processing' },
  { number: 5, title: 'FRIA', description: 'Fundamental rights' },
  { number: 6, title: 'Result', description: 'Risk classification' },
  { number: 7, title: 'Next Steps', description: 'Compliance roadmap' },
]

const ANNEX_III_CATEGORIES: { value: AnnexIIICategory; label: string; description: string }[] = [
  { value: 'biometrics', label: 'Biometric Identification', description: 'Remote biometric identification systems' },
  { value: 'critical_infrastructure', label: 'Critical Infrastructure', description: 'Safety components in critical infrastructure' },
  { value: 'education', label: 'Education & Training', description: 'Access to education or vocational training' },
  { value: 'employment', label: 'Employment', description: 'Recruitment, management, or worker decisions' },
  { value: 'essential_services', label: 'Essential Services', description: 'Access to essential services (credit, benefits)' },
  { value: 'law_enforcement', label: 'Law Enforcement', description: 'Law enforcement applications' },
  { value: 'migration', label: 'Migration & Border', description: 'Migration, asylum, and border control' },
  { value: 'justice', label: 'Justice & Democracy', description: 'Administration of justice' },
]

const PROHIBITED_FIELDS = [
  'usesSocialScoring',
  'usesBiometricIdentification',
  'usesEmotionRecognition',
  'usesPredictivePolicing',
  'usesSubliminalManipulation',
  'exploitsVulnerabilities',
] as const

const DRAFT_KEY = 'assessment_wizard_draft'

interface WizardState extends Partial<AssessmentWizardData> {
  projectId: string
}

const defaultFormData: WizardState = {
  projectId: '',
  name: '',
  description: '',
  version: '',
  useCaseDescription: '',
  annexIIICategory: null,
  usesBiometricIdentification: false,
  usesSocialScoring: false,
  usesEmotionRecognition: false,
  usesPredictivePolicing: false,
  usesSubliminalManipulation: false,
  exploitsVulnerabilities: false,
  deployedInEU: true,
  affectsEUCitizens: true,
  intendedPurpose: '',
  intendedUsers: '',
  deploymentScale: 'limited',
  automationLevel: 'semi_automated',
  processesPersonalData: false,
  processesSensitiveData: false,
  usesProfilingOrScoring: false,
  hasLegalEffects: false,
  hasSafetyImpact: false,
  affectsVulnerableGroups: false,
  dataCategories: [],
  friaAffectedGroups: '',
  friaPotentialDiscrimination: '',
  friaFundamentalRightsImpact: '',
  friaMitigationMeasures: '',
}

function loadDraft(): { formData: WizardState; currentStep: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { formData: WizardState; currentStep: number }
    if (parsed.formData && typeof parsed.currentStep === 'number') {
      return parsed
    }
  } catch {
    // Corrupt draft — ignore
  }
  return null
}

function saveDraft(formData: WizardState, currentStep: number): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }))
  } catch {
    // Storage full or unavailable — ignore
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Ignore
  }
}

export function AssessmentWizard(): React.JSX.Element {
  const router = useRouter()
  const { data: projects } = useProjects()
  const submitAssessment = useSubmitAssessment()

  // Load draft once per mount — safe with React Strict Mode
  const initialDraft = useMemo(() => loadDraft(), [])

  const [currentStep, setCurrentStep] = useState(
    () => initialDraft?.currentStep ?? 1
  )
  const [formData, setFormData] = useState<WizardState>(
    () => initialDraft?.formData ?? { ...defaultFormData }
  )
  const [showDraftBanner, setShowDraftBanner] = useState(
    () => initialDraft !== null
  )

  const [assessmentResult, setAssessmentResult] = useState<{
    riskLevel: RiskLevel
    reasoning: string[]
    applicableArticles: string[]
    prohibitedReason?: string
    systemId?: string
  } | null>(null)

  // Auto-save to localStorage on changes (debounced by React batching)
  const isDirty = useRef(false)
  useEffect(() => {
    // Don't save result steps or empty state
    if (currentStep >= 6 || (!formData.name && !formData.projectId)) return
    isDirty.current = true
    saveDraft(formData, currentStep)
  }, [formData, currentStep])

  // beforeunload warning for unsaved data
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent): void => {
      if (isDirty.current && currentStep < 6) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentStep])

  const handleDiscardDraft = useCallback(() => {
    clearDraft()
    setFormData({ ...defaultFormData })
    setCurrentStep(1)
    setShowDraftBanner(false)
    isDirty.current = false
    toast.success('Draft discarded')
  }, [])

  const updateFormData = <K extends keyof WizardState>(key: K, value: WizardState[K]): void => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Check for prohibited practices
  const hasProhibitedPractice = PROHIBITED_FIELDS.some(
    (field) => formData[field] === true
  )

  // FRIA is mandatory for high-risk indicators (EU AI Act Art. 26)
  const friaRequired = !!formData.annexIIICategory
    || formData.hasLegalEffects === true
    || formData.hasSafetyImpact === true
    || formData.affectsVulnerableGroups === true

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.projectId && !!formData.name
      case 2:
        return !!formData.useCaseDescription && !hasProhibitedPractice
      case 3:
        return !!formData.intendedPurpose
      case 4:
        return true // All optional
      case 5:
        // FRIA required only for high-risk indicators; optional otherwise
        if (friaRequired) {
          return !!formData.friaAffectedGroups && !!formData.friaFundamentalRightsImpact
        }
        return true
      case 6:
        return !!assessmentResult
      default:
        return true
    }
  }

  const handleNext = async (): Promise<void> => {
    if (currentStep === 5) {
      // Submit assessment after FRIA step
      try {
        const result = await submitAssessment.mutateAsync(formData as AssessmentWizardData)
        setAssessmentResult({
          ...result.classification,
          systemId: result.system.id,
        })
        clearDraft()
        isDirty.current = false
        setCurrentStep(6)
      } catch {
        toast.error('Failed to assess system')
      }
    } else if (currentStep < 7) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = (): void => {
    clearDraft()
    isDirty.current = false
    if (assessmentResult?.systemId) {
      router.push(`/dashboard/compliance/systems/${assessmentResult.systemId}`)
    } else {
      router.push('/dashboard/compliance')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Draft recovery banner */}
      {showDraftBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="text-sm text-blue-800">
            <span className="font-medium">Draft restored.</span>{' '}
            You have unsaved progress from a previous session.
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-700 hover:text-blue-900 shrink-0"
            onClick={handleDiscardDraft}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Discard draft
          </Button>
        </div>
      )}

      {/* Progress Steps */}
      <nav aria-label="Assessment progress" className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 shadow-sm',
                    currentStep === step.number
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : 'bg-black/5 text-black/40'
                  )}
                  aria-current={currentStep === step.number ? 'step' : undefined}
                >
                  {currentStep > step.number ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="text-xs mt-1.5 text-black/50 hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-8 sm:w-16 mx-2 transition-colors duration-300',
                    currentStep > step.number ? 'bg-green-500' : 'bg-black/10'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
        {currentStep === 1 && (
          <Step1BasicInfo
            formData={formData}
            updateFormData={updateFormData}
            projects={projects || []}
          />
        )}
        {currentStep === 2 && (
          <Step2UseCase
            formData={formData}
            updateFormData={updateFormData}
            hasProhibitedPractice={hasProhibitedPractice}
          />
        )}
        {currentStep === 3 && (
          <Step3Deployment formData={formData} updateFormData={updateFormData} />
        )}
        {currentStep === 4 && (
          <Step4DataImpact formData={formData} updateFormData={updateFormData} />
        )}
        {currentStep === 5 && (
          <Step5FRIA formData={formData} updateFormData={updateFormData} friaRequired={friaRequired} />
        )}
        {currentStep === 6 && assessmentResult && (
          <Step6Result result={assessmentResult} systemName={formData.name || ''} />
        )}
        {currentStep === 7 && assessmentResult && (
          <Step7NextSteps result={assessmentResult} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < 7 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || submitAssessment.isPending}
          >
            {submitAssessment.isPending ? (
              'Analyzing...'
            ) : currentStep === 5 ? (
              'Analyze Risk'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleFinish}>
            View System Details
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================
// Step Components
// ============================================

function Step1BasicInfo({
  formData,
  updateFormData,
  projects,
}: {
  formData: WizardState
  updateFormData: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  projects: { id: string; name: string }[]
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Basic Information</h2>
        <p className="text-black/50 text-sm">
          Identify your AI system for compliance tracking.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="project">Project *</Label>
          <Select
            value={formData.projectId}
            onValueChange={(value) => updateFormData('projectId', value)}
          >
            <SelectTrigger id="project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-black/40 mt-1">
            The project this AI system belongs to.
          </p>
        </div>

        <div>
          <Label htmlFor="name">System Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            placeholder="e.g., Customer Support Chatbot"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData('description', e.target.value)}
            placeholder="Brief description of what the AI system does..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={formData.version}
            onChange={(e) => updateFormData('version', e.target.value)}
            placeholder="e.g., 1.0.0"
          />
        </div>
      </div>
    </div>
  )
}

function Step2UseCase({
  formData,
  updateFormData,
  hasProhibitedPractice,
}: {
  formData: WizardState
  updateFormData: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  hasProhibitedPractice: boolean
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Use Case & Category</h2>
        <p className="text-black/50 text-sm">
          Describe what your AI system does and select the relevant Annex III category.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="useCase">Use Case Description *</Label>
          <Textarea
            id="useCase"
            value={formData.useCaseDescription}
            onChange={(e) => updateFormData('useCaseDescription', e.target.value)}
            placeholder="Describe the primary use case of this AI system..."
            rows={4}
          />
        </div>

        <div>
          <Label>Annex III Category (High-Risk)</Label>
          <p className="text-xs text-black/40 mb-2">
            Select if your system falls under one of these high-risk categories.
          </p>
          <div className="grid gap-2">
            <div
              className={cn(
                'p-4 border rounded-xl cursor-pointer transition-all hover:shadow-sm',
                formData.annexIIICategory === null
                  ? 'border-primary bg-primary/5'
                  : 'border-black/10 hover:border-black/20'
              )}
              onClick={() => updateFormData('annexIIICategory', null)}
            >
              <div className="font-medium text-sm">None of the above</div>
              <div className="text-xs text-black/50">
                My system does not fall into a high-risk category.
              </div>
            </div>
            {ANNEX_III_CATEGORIES.map((cat) => (
              <div
                key={cat.value}
                className={cn(
                  'p-4 border rounded-xl cursor-pointer transition-all hover:shadow-sm',
                  formData.annexIIICategory === cat.value
                    ? 'border-primary bg-primary/5'
                    : 'border-black/10 hover:border-black/20'
                )}
                onClick={() => updateFormData('annexIIICategory', cat.value)}
              >
                <div className="font-medium text-sm">{cat.label}</div>
                <div className="text-xs text-black/50">{cat.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Prohibited Use Checkboxes */}
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl">
          <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
            <AlertOctagon className="h-4 w-4" />
            Prohibited Practices Check
          </h4>
          <p className="text-xs text-red-700 mb-3">
            These uses are banned under Article 5 of the EU AI Act.
          </p>
          <div className="space-y-2">
            <CheckboxItem
              checked={formData.usesSocialScoring || false}
              onChange={(v) => updateFormData('usesSocialScoring', v)}
              label="Uses social scoring by public authorities"
            />
            <CheckboxItem
              checked={formData.usesBiometricIdentification || false}
              onChange={(v) => updateFormData('usesBiometricIdentification', v)}
              label="Real-time remote biometric identification"
            />
            <CheckboxItem
              checked={formData.usesEmotionRecognition || false}
              onChange={(v) => updateFormData('usesEmotionRecognition', v)}
              label="Emotion recognition at workplace/school"
            />
            <CheckboxItem
              checked={formData.usesPredictivePolicing || false}
              onChange={(v) => updateFormData('usesPredictivePolicing', v)}
              label="Predictive policing based on profiling"
            />
            <CheckboxItem
              checked={formData.usesSubliminalManipulation || false}
              onChange={(v) => updateFormData('usesSubliminalManipulation', v)}
              label="Subliminal manipulation techniques"
            />
            <CheckboxItem
              checked={formData.exploitsVulnerabilities || false}
              onChange={(v) => updateFormData('exploitsVulnerabilities', v)}
              label="Exploits vulnerabilities of specific groups"
            />
          </div>
        </div>

        {/* Prohibited Practice Alert */}
        {hasProhibitedPractice && (
          <div
            role="alert"
            className="p-5 bg-red-100 border-2 border-red-400 rounded-xl"
          >
            <h4 className="font-semibold text-red-900 mb-1 flex items-center gap-2">
              <AlertOctagon className="h-5 w-5" />
              Prohibited Practice Detected
            </h4>
            <p className="text-sm text-red-800">
              This AI system involves prohibited practices under EU AI Act Article 5.
              It cannot be registered. Please review your use case and uncheck
              all prohibited practices to proceed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Step3Deployment({
  formData,
  updateFormData,
}: {
  formData: WizardState
  updateFormData: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Deployment Context</h2>
        <p className="text-black/50 text-sm">
          Where and how will your AI system be deployed?
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 border border-black/10 rounded-xl">
            <CheckboxItem
              checked={formData.deployedInEU || false}
              onChange={(v) => updateFormData('deployedInEU', v)}
              label="Deployed in the EU"
            />
            <p className="text-xs text-black/40 mt-1 ml-6">
              System operates within EU member states.
            </p>
          </div>
          <div className="p-4 border border-black/10 rounded-xl">
            <CheckboxItem
              checked={formData.affectsEUCitizens || false}
              onChange={(v) => updateFormData('affectsEUCitizens', v)}
              label="Affects EU citizens"
            />
            <p className="text-xs text-black/40 mt-1 ml-6">
              Output affects EU residents.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="purpose">Intended Purpose *</Label>
          <Textarea
            id="purpose"
            value={formData.intendedPurpose}
            onChange={(e) => updateFormData('intendedPurpose', e.target.value)}
            placeholder="What is the system designed to do? What decisions or recommendations does it make?"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="users">Intended Users</Label>
          <Input
            id="users"
            value={formData.intendedUsers}
            onChange={(e) => updateFormData('intendedUsers', e.target.value)}
            placeholder="e.g., Customer service agents, HR managers..."
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scale">Deployment Scale</Label>
            <Select
              value={formData.deploymentScale}
              onValueChange={(value) =>
                updateFormData('deploymentScale', value as WizardState['deploymentScale'])
              }
            >
              <SelectTrigger id="scale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prototype">Prototype / Testing</SelectItem>
                <SelectItem value="limited">Limited Deployment</SelectItem>
                <SelectItem value="wide">Wide Deployment</SelectItem>
                <SelectItem value="mass">Mass Market</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="automation">Automation Level</Label>
            <Select
              value={formData.automationLevel}
              onValueChange={(value) =>
                updateFormData('automationLevel', value as WizardState['automationLevel'])
              }
            >
              <SelectTrigger id="automation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="human_assisted">Human-Assisted</SelectItem>
                <SelectItem value="semi_automated">Semi-Automated</SelectItem>
                <SelectItem value="fully_automated">Fully Automated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step4DataImpact({
  formData,
  updateFormData,
}: {
  formData: WizardState
  updateFormData: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Data & Impact Assessment</h2>
        <p className="text-black/50 text-sm">
          Help us understand the data your system processes and its potential impact.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Data Processing
          </h4>
          <div className="space-y-2">
            <CheckboxItem
              checked={formData.processesPersonalData || false}
              onChange={(v) => updateFormData('processesPersonalData', v)}
              label="Processes personal data"
            />
            <CheckboxItem
              checked={formData.processesSensitiveData || false}
              onChange={(v) => updateFormData('processesSensitiveData', v)}
              label="Processes sensitive data (health, biometric, etc.)"
            />
            <CheckboxItem
              checked={formData.usesProfilingOrScoring || false}
              onChange={(v) => updateFormData('usesProfilingOrScoring', v)}
              label="Uses profiling or scoring of individuals"
            />
          </div>
        </div>

        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <h4 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Impact Assessment
          </h4>
          <div className="space-y-2">
            <CheckboxItem
              checked={formData.hasLegalEffects || false}
              onChange={(v) => updateFormData('hasLegalEffects', v)}
              label="Has legal or similar significant effects on individuals"
            />
            <CheckboxItem
              checked={formData.hasSafetyImpact || false}
              onChange={(v) => updateFormData('hasSafetyImpact', v)}
              label="Has potential safety impact"
            />
            <CheckboxItem
              checked={formData.affectsVulnerableGroups || false}
              onChange={(v) => updateFormData('affectsVulnerableGroups', v)}
              label="Affects vulnerable groups (children, elderly, disabled)"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step5FRIA({
  formData,
  updateFormData,
  friaRequired,
}: {
  formData: WizardState
  updateFormData: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  friaRequired: boolean
}): React.JSX.Element {
  const requiredMark = friaRequired ? ' *' : ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Fundamental Rights Impact Assessment</h2>
        <p className="text-black/50 text-sm">
          Assess the impact of your AI system on fundamental rights (EU AI Act Article 26).
        </p>
      </div>

      {friaRequired ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-1.5" />
            Your system has high-risk indicators. A Fundamental Rights Impact Assessment is
            <strong> required</strong> under EU AI Act Article 26(1) before deployment.
          </p>
        </div>
      ) : (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <Info className="h-4 w-4 inline mr-1.5" />
            FRIA is optional for your risk profile but recommended. You can skip this step
            or provide partial information.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="friaAffectedGroups">Affected Population Groups{requiredMark}</Label>
          <Textarea
            id="friaAffectedGroups"
            value={formData.friaAffectedGroups || ''}
            onChange={(e) => updateFormData('friaAffectedGroups', e.target.value)}
            placeholder="Describe the groups of people affected by this AI system (e.g., job applicants, patients, students)..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="friaFundamentalRightsImpact">Impact on Fundamental Rights{requiredMark}</Label>
          <Textarea
            id="friaFundamentalRightsImpact"
            value={formData.friaFundamentalRightsImpact || ''}
            onChange={(e) => updateFormData('friaFundamentalRightsImpact', e.target.value)}
            placeholder="Analyze impact on fundamental rights: dignity, privacy, non-discrimination, data protection, freedom of expression, effective remedy..."
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="friaPotentialDiscrimination">Potential Discrimination Risks</Label>
          <Textarea
            id="friaPotentialDiscrimination"
            value={formData.friaPotentialDiscrimination || ''}
            onChange={(e) => updateFormData('friaPotentialDiscrimination', e.target.value)}
            placeholder="Identify potential discrimination risks across protected characteristics (gender, race, age, disability, religion, etc.)..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="friaMitigationMeasures">Mitigation Measures</Label>
          <Textarea
            id="friaMitigationMeasures"
            value={formData.friaMitigationMeasures || ''}
            onChange={(e) => updateFormData('friaMitigationMeasures', e.target.value)}
            placeholder="Describe concrete measures to mitigate identified risks (bias testing, human oversight, appeal mechanisms, etc.)..."
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}

function Step6Result({
  result,
  systemName,
}: {
  result: {
    riskLevel: RiskLevel
    reasoning: string[]
    applicableArticles: string[]
    prohibitedReason?: string
  }
  systemName: string
}): React.JSX.Element {
  const riskConfig = {
    PROHIBITED: {
      color: 'bg-red-100 border-red-300 text-red-800',
      icon: AlertOctagon,
      title: 'Prohibited',
      description: 'This AI system falls under prohibited practices and cannot be deployed in the EU.',
    },
    HIGH: {
      color: 'bg-orange-100 border-orange-300 text-orange-800',
      icon: AlertTriangle,
      title: 'High Risk',
      description: 'This system requires strict compliance with EU AI Act requirements.',
    },
    LIMITED: {
      color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      icon: Info,
      title: 'Limited Risk',
      description: 'This system has transparency obligations but no other specific requirements.',
    },
    MINIMAL: {
      color: 'bg-green-100 border-green-300 text-green-800',
      icon: CheckCircle2,
      title: 'Minimal Risk',
      description: 'No specific EU AI Act obligations. Voluntary codes of conduct apply.',
    },
    UNKNOWN: {
      color: 'bg-gray-100 border-gray-300 text-gray-800',
      icon: Shield,
      title: 'Unknown',
      description: 'Risk level could not be determined.',
    },
  }

  const config = riskConfig[result.riskLevel]
  const Icon = config.icon

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Classification Result</h2>
        <p className="text-black/50 text-sm">
          Risk assessment for {systemName}
        </p>
      </div>

      <div className={cn('p-6 border-2 rounded-2xl', config.color)}>
        <div className="flex items-center gap-3 mb-3">
          <Icon className="h-8 w-8" />
          <div>
            <div className="text-2xl font-bold">{config.title}</div>
            <div className="text-sm opacity-80">{config.description}</div>
          </div>
        </div>
      </div>

      {result.prohibitedReason && (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl">
          <h4 className="font-medium text-red-800 mb-2">Prohibition Reason</h4>
          <p className="text-sm text-red-700">{result.prohibitedReason}</p>
        </div>
      )}

      <div>
        <h4 className="font-medium mb-2">Classification Reasoning</h4>
        <ul className="space-y-2">
          {result.reasoning.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-black/70">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-black/30 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {result.applicableArticles.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Applicable EU AI Act Articles</h4>
          <div className="flex flex-wrap gap-2">
            {result.applicableArticles.map((article) => (
              <span
                key={article}
                className="px-3 py-1.5 bg-black/5 rounded-lg text-sm"
              >
                {article}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Step7NextSteps({
  result,
}: {
  result: {
    riskLevel: RiskLevel
    applicableArticles: string[]
  }
}): React.JSX.Element {
  const getNextSteps = (riskLevel: RiskLevel): string[] => {
    switch (riskLevel) {
      case 'PROHIBITED':
        return [
          'This system cannot be deployed in the EU.',
          'Review Article 5 of the EU AI Act for prohibited practices.',
          'Consider modifying the system to remove prohibited features.',
          'Consult with legal counsel for guidance.',
        ]
      case 'HIGH':
        return [
          'Complete the obligations checklist in the system details.',
          'Generate required compliance documentation.',
          'Implement human oversight measures.',
          'Prepare for conformity assessment.',
          'Register the system in the EU database before deployment.',
          'Set up post-market monitoring.',
        ]
      case 'LIMITED':
        return [
          'Implement transparency obligations (Article 50).',
          'Ensure users know they are interacting with AI.',
          'Label any generated/synthetic content appropriately.',
          'Document compliance measures.',
        ]
      case 'MINIMAL':
        return [
          'No mandatory requirements under EU AI Act.',
          'Consider voluntary codes of conduct.',
          'Keep documentation for internal governance.',
          'Monitor for any changes in risk profile.',
        ]
      default:
        return ['Review the classification and consult with experts.']
    }
  }

  const steps = getNextSteps(result.riskLevel)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Compliance Roadmap</h2>
        <p className="text-black/50 text-sm">
          Recommended next steps based on your risk classification.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-4 bg-black/[0.02] rounded-xl"
          >
            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
              {idx + 1}
            </div>
            <span className="text-sm pt-0.5">{step}</span>
          </div>
        ))}
      </div>

      {result.riskLevel === 'HIGH' && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Required Documentation
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Technical Documentation (Article 11)</li>
            <li>Risk Management Plan (Article 9)</li>
            <li>Data Governance Documentation (Article 10)</li>
            <li>Human Oversight Documentation (Article 14)</li>
            <li>EU Declaration of Conformity (Article 47)</li>
          </ul>
          <p className="text-xs text-blue-600 mt-2">
            You can generate these documents from the system details page.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Helper Components
// ============================================

function CheckboxItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-black/20 text-primary focus:ring-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}
