import { z } from 'zod'

// ============================================
// Enums matching Prisma
// ============================================

export const RiskLevelSchema = z.enum([
  'PROHIBITED',
  'HIGH',
  'LIMITED',
  'MINIMAL',
  'UNKNOWN'
])

export const ComplianceStatusSchema = z.enum([
  'NOT_ASSESSED',
  'IN_PROGRESS',
  'COMPLIANT',
  'NON_COMPLIANT',
  'EXEMPT'
])

export const ObligationStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'NOT_APPLICABLE'
])

export const DocumentTypeSchema = z.enum([
  'TECHNICAL_DOCUMENTATION',
  'RISK_MANAGEMENT',
  'DATA_GOVERNANCE',
  'HUMAN_OVERSIGHT',
  'CONFORMITY_DECLARATION',
  'FRIA',
  'TRANSPARENCY_NOTICE',
  'INCIDENT_REPORT',
  'POST_MARKET_MONITORING'
])

export const IncidentSeveritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
])

export const IncidentTypeSchema = z.enum([
  'SAFETY',
  'FUNDAMENTAL_RIGHTS',
  'MALFUNCTION',
  'MISUSE',
  'SECURITY',
  'OTHER'
])

// ============================================
// Annex III Categories (High-Risk)
// ============================================

export const AnnexIIICategorySchema = z.enum([
  'biometrics',                    // 1. Biometric identification
  'critical_infrastructure',       // 2. Critical infrastructure management
  'education',                     // 3. Education and vocational training
  'employment',                    // 4. Employment, workers management
  'essential_services',            // 5. Access to essential services
  'law_enforcement',               // 6. Law enforcement
  'migration',                     // 7. Migration, asylum, border control
  'justice'                        // 8. Administration of justice
])

// ============================================
// Wizard Step Schemas
// ============================================

// Step 1: Basic Information
export const WizardStep1Schema = z.object({
  step: z.literal(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).optional(),
  projectId: z.string().min(1)
})

// Step 2: Use Case / Annex III Category
export const WizardStep2Schema = z.object({
  step: z.literal(2),
  useCaseDescription: z.string().min(1).max(5000),
  annexIIICategory: AnnexIIICategorySchema.nullable(),
  // Specific use case flags for prohibited detection
  usesBiometricIdentification: z.boolean().default(false),
  usesSocialScoring: z.boolean().default(false),
  usesEmotionRecognition: z.boolean().default(false),
  usesPredictivePolicing: z.boolean().default(false),
  usesSubliminalManipulation: z.boolean().default(false),
  exploitsVulnerabilities: z.boolean().default(false)
})

// Step 3: Deployment Context
export const WizardStep3Schema = z.object({
  step: z.literal(3),
  deployedInEU: z.boolean(),
  affectsEUCitizens: z.boolean(),
  intendedPurpose: z.string().min(1).max(2000),
  intendedUsers: z.string().max(1000).optional(),
  deploymentScale: z.enum(['prototype', 'limited', 'wide', 'mass']).default('limited'),
  automationLevel: z.enum(['fully_automated', 'semi_automated', 'human_assisted']).default('semi_automated')
})

// Step 4: Data & Impact
export const WizardStep4Schema = z.object({
  step: z.literal(4),
  processesPersonalData: z.boolean(),
  processesSensitiveData: z.boolean().default(false), // Special categories (Art. 9 GDPR)
  usesProfilingOrScoring: z.boolean().default(false),
  hasLegalEffects: z.boolean().default(false), // Affects legal rights
  hasSafetyImpact: z.boolean().default(false),
  affectsVulnerableGroups: z.boolean().default(false),
  dataCategories: z.array(z.string()).default([])
})

// Combined wizard data for assessment
export const AssessmentWizardDataSchema = z.object({
  // Step 1
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).optional(),
  projectId: z.string().min(1),

  // Step 2
  useCaseDescription: z.string().min(1).max(5000),
  annexIIICategory: AnnexIIICategorySchema.nullable(),
  usesBiometricIdentification: z.boolean().default(false),
  usesSocialScoring: z.boolean().default(false),
  usesEmotionRecognition: z.boolean().default(false),
  usesPredictivePolicing: z.boolean().default(false),
  usesSubliminalManipulation: z.boolean().default(false),
  exploitsVulnerabilities: z.boolean().default(false),

  // Step 3
  deployedInEU: z.boolean(),
  affectsEUCitizens: z.boolean(),
  intendedPurpose: z.string().min(1).max(2000),
  intendedUsers: z.string().max(1000).optional(),
  deploymentScale: z.enum(['prototype', 'limited', 'wide', 'mass']).default('limited'),
  automationLevel: z.enum(['fully_automated', 'semi_automated', 'human_assisted']).default('semi_automated'),

  // Step 4
  processesPersonalData: z.boolean(),
  processesSensitiveData: z.boolean().default(false),
  usesProfilingOrScoring: z.boolean().default(false),
  hasLegalEffects: z.boolean().default(false),
  hasSafetyImpact: z.boolean().default(false),
  affectsVulnerableGroups: z.boolean().default(false),
  dataCategories: z.array(z.string()).default([]),

  // Step 5: FRIA
  friaAffectedGroups: z.string().max(5000).optional(),
  friaPotentialDiscrimination: z.string().max(5000).optional(),
  friaFundamentalRightsImpact: z.string().max(5000).optional(),
  friaMitigationMeasures: z.string().max(5000).optional()
})

export type AssessmentWizardData = z.infer<typeof AssessmentWizardDataSchema>

// ============================================
// AI System Schemas
// ============================================

export const CreateAISystemSchema = AssessmentWizardDataSchema

export const UpdateAISystemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).optional(),
  complianceStatus: ComplianceStatusSchema.optional()
})

export const AISystemQuerySchema = z.object({
  projectId: z.string().optional(),
  riskLevel: RiskLevelSchema.optional(),
  complianceStatus: ComplianceStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

// ============================================
// Obligation Schemas
// ============================================

export const UpdateObligationSchema = z.object({
  status: ObligationStatusSchema,
  notes: z.string().max(2000).optional()
})

// ============================================
// Document Schemas
// ============================================

export const GenerateDocumentSchema = z.object({
  aiSystemId: z.string().min(1),
  type: DocumentTypeSchema
})

export const DocumentQuerySchema = z.object({
  aiSystemId: z.string().optional(),
  type: DocumentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

// ============================================
// Incident Schemas
// ============================================

export const CreateIncidentSchema = z.object({
  aiSystemId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  severity: IncidentSeveritySchema,
  type: IncidentTypeSchema,
  occurredAt: z.coerce.date(),
  detectedAt: z.coerce.date(),
  impactDescription: z.string().max(10000).optional(),
  affectedUsers: z.number().int().min(0).optional()
})

export const UpdateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  severity: IncidentSeveritySchema.optional(),
  resolvedAt: z.coerce.date().optional(),
  rootCause: z.string().max(10000).optional(),
  remediationSteps: z.string().max(10000).optional(),
  preventiveMeasures: z.string().max(10000).optional(),
  reportedToAuthority: z.boolean().optional(),
  reportedAt: z.coerce.date().optional()
})

export const IncidentQuerySchema = z.object({
  aiSystemId: z.string().optional(),
  severity: IncidentSeveritySchema.optional(),
  type: IncidentTypeSchema.optional(),
  resolved: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

// ============================================
// Human Oversight Schemas
// ============================================

export const OversightLevelSchema = z.enum(['MONITORING', 'APPROVAL', 'FULL_CONTROL'])

export const UpdateOversightSchema = z.object({
  oversightLevel: OversightLevelSchema.optional(),
  humanInLoop: z.boolean().optional(),
  humanOnLoop: z.boolean().optional(),
  humanInCommand: z.boolean().optional(),
  canInterrupt: z.boolean().optional(),
  canOverride: z.boolean().optional(),
  canShutdown: z.boolean().optional(),
  monitoringFrequency: z.enum(['real-time', 'hourly', 'daily', 'weekly']).optional(),
  alertThresholds: z.record(z.unknown()).optional(),
  responsiblePersons: z.array(z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.string()
  })).optional(),
  trainingRequired: z.boolean().optional(),
  trainingCompleted: z.boolean().optional(),
  procedureDocumented: z.boolean().optional()
})

// ============================================
// Stats Schema
// ============================================

export const StatsQuerySchema = z.object({
  projectId: z.string().optional()
})

// ============================================
// Type exports
// ============================================

export type RiskLevel = z.infer<typeof RiskLevelSchema>
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>
export type DocumentType = z.infer<typeof DocumentTypeSchema>
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>
export type IncidentType = z.infer<typeof IncidentTypeSchema>
export type AnnexIIICategory = z.infer<typeof AnnexIIICategorySchema>
