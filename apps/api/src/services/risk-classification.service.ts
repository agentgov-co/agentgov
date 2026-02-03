import type { AssessmentWizardData, RiskLevel, AnnexIIICategory } from '../schemas/compliance.schema.js'

// ============================================
// EU AI Act Article References
// ============================================

const ARTICLES = {
  // Prohibited (Article 5)
  PROHIBITED_PRACTICES: 'Article 5',

  // High-Risk Requirements (Chapter 2)
  RISK_MANAGEMENT: 'Article 9',
  DATA_GOVERNANCE: 'Article 10',
  TECHNICAL_DOCUMENTATION: 'Article 11',
  RECORD_KEEPING: 'Article 12',
  TRANSPARENCY_INFO: 'Article 13',
  HUMAN_OVERSIGHT: 'Article 14',
  ACCURACY_ROBUSTNESS: 'Article 15',

  // Registration & Conformity
  CE_MARKING: 'Article 48',
  CONFORMITY_ASSESSMENT: 'Article 43',
  EU_DECLARATION: 'Article 47',
  REGISTRATION: 'Article 49',

  // Limited Risk (Transparency)
  TRANSPARENCY_OBLIGATIONS: 'Article 50',

  // Post-Market
  POST_MARKET_MONITORING: 'Article 72',
  INCIDENT_REPORTING: 'Article 62',

  // GPAI
  GPAI_REQUIREMENTS: 'Article 53'
} as const

// ============================================
// Annex III Category Descriptions
// ============================================

export const ANNEX_III_CATEGORIES: Record<AnnexIIICategory, {
  name: string
  description: string
  examples: string[]
}> = {
  biometrics: {
    name: 'Biometric Identification',
    description: 'Remote biometric identification systems (except for narrow law enforcement exceptions)',
    examples: [
      'Facial recognition for identification',
      'Fingerprint matching at scale',
      'Voice identification systems',
      'Gait recognition'
    ]
  },
  critical_infrastructure: {
    name: 'Critical Infrastructure',
    description: 'AI systems as safety components in critical infrastructure management',
    examples: [
      'Traffic management systems',
      'Power grid management',
      'Water supply management',
      'Gas/heating network control'
    ]
  },
  education: {
    name: 'Education and Vocational Training',
    description: 'AI systems determining access to or affecting education outcomes',
    examples: [
      'Automated grading systems',
      'Student admission decisions',
      'Proctoring systems',
      'Learning analytics affecting progression'
    ]
  },
  employment: {
    name: 'Employment and Workers Management',
    description: 'AI systems for recruitment, management, and termination decisions',
    examples: [
      'CV screening and ranking',
      'Automated interview analysis',
      'Performance monitoring',
      'Promotion/termination recommendations'
    ]
  },
  essential_services: {
    name: 'Essential Services Access',
    description: 'AI systems affecting access to essential private/public services',
    examples: [
      'Credit scoring',
      'Insurance risk assessment',
      'Social benefit eligibility',
      'Emergency services dispatching'
    ]
  },
  law_enforcement: {
    name: 'Law Enforcement',
    description: 'AI systems used by law enforcement for various purposes',
    examples: [
      'Risk assessment of offending',
      'Lie detectors / polygraphs',
      'Evidence analysis',
      'Crime prediction (non-prohibited)'
    ]
  },
  migration: {
    name: 'Migration and Border Control',
    description: 'AI systems used in migration, asylum and border control management',
    examples: [
      'Visa application assessment',
      'Asylum claim processing',
      'Border surveillance',
      'Travel document verification'
    ]
  },
  justice: {
    name: 'Administration of Justice',
    description: 'AI systems used in judicial processes and legal research',
    examples: [
      'Legal research AI',
      'Sentencing recommendation',
      'Case outcome prediction',
      'Legal document analysis'
    ]
  }
}

// ============================================
// Risk Classification Result
// ============================================

export interface RiskClassificationResult {
  riskLevel: RiskLevel
  reasoning: string[]
  applicableArticles: string[]
  prohibitedReason?: string
  annexIIICategory?: AnnexIIICategory
  obligations: ObligationTemplate[]
}

export interface ObligationTemplate {
  articleNumber: string
  articleTitle: string
  description: string
  deadline?: string // Relative deadline description
}

// ============================================
// Classification Logic
// ============================================

export function classifyRisk(data: AssessmentWizardData): RiskClassificationResult {
  const reasoning: string[] = []
  const applicableArticles: string[] = []

  // Step 1: Check for PROHIBITED uses (Article 5)
  const prohibitedCheck = checkProhibited(data)
  if (prohibitedCheck.isProhibited) {
    return {
      riskLevel: 'PROHIBITED',
      reasoning: prohibitedCheck.reasons,
      applicableArticles: [ARTICLES.PROHIBITED_PRACTICES],
      prohibitedReason: prohibitedCheck.reasons.join('; '),
      obligations: []
    }
  }

  // Step 2: Check if outside EU scope
  if (!data.deployedInEU && !data.affectsEUCitizens) {
    reasoning.push('System is not deployed in EU and does not affect EU citizens')
    return {
      riskLevel: 'MINIMAL',
      reasoning,
      applicableArticles: [],
      obligations: []
    }
  }

  // Step 3: Check for HIGH risk (Annex III)
  if (data.annexIIICategory) {
    reasoning.push(`Falls under Annex III category: ${ANNEX_III_CATEGORIES[data.annexIIICategory].name}`)
    applicableArticles.push(
      ARTICLES.RISK_MANAGEMENT,
      ARTICLES.DATA_GOVERNANCE,
      ARTICLES.TECHNICAL_DOCUMENTATION,
      ARTICLES.RECORD_KEEPING,
      ARTICLES.TRANSPARENCY_INFO,
      ARTICLES.HUMAN_OVERSIGHT,
      ARTICLES.ACCURACY_ROBUSTNESS,
      ARTICLES.CONFORMITY_ASSESSMENT,
      ARTICLES.EU_DECLARATION,
      ARTICLES.REGISTRATION,
      ARTICLES.POST_MARKET_MONITORING,
      ARTICLES.INCIDENT_REPORTING
    )

    return {
      riskLevel: 'HIGH',
      reasoning,
      applicableArticles,
      annexIIICategory: data.annexIIICategory,
      obligations: generateHighRiskObligations()
    }
  }

  // Step 4: Check for implicit HIGH risk factors
  const highRiskFactors = checkHighRiskFactors(data)
  if (highRiskFactors.isHighRisk) {
    reasoning.push(...highRiskFactors.reasons)
    applicableArticles.push(
      ARTICLES.RISK_MANAGEMENT,
      ARTICLES.DATA_GOVERNANCE,
      ARTICLES.TECHNICAL_DOCUMENTATION,
      ARTICLES.RECORD_KEEPING,
      ARTICLES.TRANSPARENCY_INFO,
      ARTICLES.HUMAN_OVERSIGHT,
      ARTICLES.ACCURACY_ROBUSTNESS,
      ARTICLES.POST_MARKET_MONITORING,
      ARTICLES.INCIDENT_REPORTING
    )

    return {
      riskLevel: 'HIGH',
      reasoning,
      applicableArticles,
      obligations: generateHighRiskObligations()
    }
  }

  // Step 5: Check for LIMITED risk (transparency requirements)
  const limitedRiskCheck = checkLimitedRisk(data)
  if (limitedRiskCheck.isLimited) {
    reasoning.push(...limitedRiskCheck.reasons)
    applicableArticles.push(ARTICLES.TRANSPARENCY_OBLIGATIONS)

    return {
      riskLevel: 'LIMITED',
      reasoning,
      applicableArticles,
      obligations: generateLimitedRiskObligations()
    }
  }

  // Step 6: Default to MINIMAL risk
  reasoning.push('No high-risk or limited-risk criteria detected')
  reasoning.push('System classified as minimal risk with no specific EU AI Act obligations')

  return {
    riskLevel: 'MINIMAL',
    reasoning,
    applicableArticles: [],
    obligations: []
  }
}

// ============================================
// Prohibited Uses Check (Article 5)
// ============================================

function checkProhibited(data: AssessmentWizardData): { isProhibited: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Social scoring by public authorities
  if (data.usesSocialScoring) {
    reasons.push('Uses social scoring which is prohibited under Article 5(1)(c)')
  }

  // Real-time remote biometric identification in public spaces for law enforcement
  if (data.usesBiometricIdentification && data.annexIIICategory === 'law_enforcement') {
    reasons.push('Uses real-time biometric identification for law enforcement, prohibited under Article 5(1)(h)')
  }

  // Subliminal manipulation
  if (data.usesSubliminalManipulation) {
    reasons.push('Uses subliminal manipulation techniques prohibited under Article 5(1)(a)')
  }

  // Exploitation of vulnerabilities
  if (data.exploitsVulnerabilities) {
    reasons.push('Exploits vulnerabilities of specific groups, prohibited under Article 5(1)(b)')
  }

  // Predictive policing based solely on profiling
  if (data.usesPredictivePolicing && data.annexIIICategory === 'law_enforcement') {
    reasons.push('Uses predictive policing based on profiling, prohibited under Article 5(1)(d)')
  }

  // Emotion recognition at workplace/education (with exceptions)
  if (data.usesEmotionRecognition &&
      (data.annexIIICategory === 'employment' || data.annexIIICategory === 'education')) {
    reasons.push('Uses emotion recognition in employment/education context, prohibited under Article 5(1)(f)')
  }

  return {
    isProhibited: reasons.length > 0,
    reasons
  }
}

// ============================================
// High Risk Factors Check
// ============================================

function checkHighRiskFactors(data: AssessmentWizardData): { isHighRisk: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Has legal effects with automation
  if (data.hasLegalEffects && data.automationLevel === 'fully_automated') {
    reasons.push('Fully automated system with legal effects on individuals')
  }

  // Safety impact
  if (data.hasSafetyImpact) {
    reasons.push('System has potential safety impact on users')
  }

  // Sensitive data processing at scale
  if (data.processesSensitiveData && data.deploymentScale === 'mass') {
    reasons.push('Processes sensitive personal data at mass scale')
  }

  // Affects vulnerable groups with significant impact
  if (data.affectsVulnerableGroups && (data.hasLegalEffects || data.hasSafetyImpact)) {
    reasons.push('Affects vulnerable groups with significant legal or safety impact')
  }

  // Profiling with legal effects
  if (data.usesProfilingOrScoring && data.hasLegalEffects) {
    reasons.push('Uses profiling/scoring that affects legal rights of individuals')
  }

  return {
    isHighRisk: reasons.length > 0,
    reasons
  }
}

// ============================================
// Limited Risk Check
// ============================================

function checkLimitedRisk(data: AssessmentWizardData): { isLimited: boolean; reasons: string[] } {
  const reasons: string[] = []

  // AI interacting with humans (chatbots, etc.)
  if (data.automationLevel !== 'human_assisted') {
    reasons.push('AI system interacts with humans and must disclose AI nature')
  }

  // Generates content (deepfakes, synthetic media)
  if (data.useCaseDescription.toLowerCase().includes('generat') ||
      data.useCaseDescription.toLowerCase().includes('syntheti') ||
      data.useCaseDescription.toLowerCase().includes('deepfake')) {
    reasons.push('AI system generates synthetic content requiring disclosure')
  }

  // Emotion recognition (non-prohibited contexts)
  if (data.usesEmotionRecognition &&
      data.annexIIICategory !== 'employment' &&
      data.annexIIICategory !== 'education') {
    reasons.push('Uses emotion recognition requiring transparency disclosure')
  }

  // Biometric categorization (non-prohibited)
  if (data.usesBiometricIdentification && data.annexIIICategory !== 'law_enforcement') {
    reasons.push('Uses biometric categorization requiring transparency disclosure')
  }

  return {
    isLimited: reasons.length > 0,
    reasons
  }
}

// ============================================
// Obligation Generation
// ============================================

function generateHighRiskObligations(): ObligationTemplate[] {
  return [
    {
      articleNumber: ARTICLES.RISK_MANAGEMENT,
      articleTitle: 'Risk Management System',
      description: 'Establish and maintain a risk management system throughout the AI system lifecycle. Identify, analyze, and mitigate risks to health, safety, and fundamental rights.'
    },
    {
      articleNumber: ARTICLES.DATA_GOVERNANCE,
      articleTitle: 'Data Governance',
      description: 'Implement data governance practices for training, validation, and testing datasets. Ensure data quality, relevance, and bias mitigation.'
    },
    {
      articleNumber: ARTICLES.TECHNICAL_DOCUMENTATION,
      articleTitle: 'Technical Documentation',
      description: 'Prepare comprehensive technical documentation demonstrating compliance with EU AI Act requirements before market placement.'
    },
    {
      articleNumber: ARTICLES.RECORD_KEEPING,
      articleTitle: 'Record Keeping',
      description: 'Implement automatic logging and event recording capabilities to ensure traceability of AI system operation.'
    },
    {
      articleNumber: ARTICLES.TRANSPARENCY_INFO,
      articleTitle: 'Transparency & Information',
      description: 'Provide clear information to deployers about system capabilities, limitations, and proper use instructions.'
    },
    {
      articleNumber: ARTICLES.HUMAN_OVERSIGHT,
      articleTitle: 'Human Oversight',
      description: 'Design the system to be effectively overseen by humans. Implement measures to allow human intervention and override.'
    },
    {
      articleNumber: ARTICLES.ACCURACY_ROBUSTNESS,
      articleTitle: 'Accuracy, Robustness & Cybersecurity',
      description: 'Ensure appropriate levels of accuracy, robustness, and cybersecurity throughout the system lifecycle.'
    },
    {
      articleNumber: ARTICLES.CONFORMITY_ASSESSMENT,
      articleTitle: 'Conformity Assessment',
      description: 'Undergo conformity assessment procedure before placing the AI system on the market.'
    },
    {
      articleNumber: ARTICLES.EU_DECLARATION,
      articleTitle: 'EU Declaration of Conformity',
      description: 'Draw up and sign an EU declaration of conformity and keep it for 10 years.'
    },
    {
      articleNumber: ARTICLES.REGISTRATION,
      articleTitle: 'EU Database Registration',
      description: 'Register the AI system in the EU database before placing on market or putting into service.'
    },
    {
      articleNumber: ARTICLES.POST_MARKET_MONITORING,
      articleTitle: 'Post-Market Monitoring',
      description: 'Establish a post-market monitoring system to collect and analyze data on performance and compliance.'
    },
    {
      articleNumber: ARTICLES.INCIDENT_REPORTING,
      articleTitle: 'Serious Incident Reporting',
      description: 'Report serious incidents to market surveillance authorities within required timeframes.'
    }
  ]
}

function generateLimitedRiskObligations(): ObligationTemplate[] {
  return [
    {
      articleNumber: ARTICLES.TRANSPARENCY_OBLIGATIONS,
      articleTitle: 'Transparency Obligations',
      description: 'Ensure users are informed they are interacting with an AI system. For synthetic content, label it as artificially generated or manipulated.'
    }
  ]
}

// ============================================
// Utility Functions
// ============================================

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'PROHIBITED': return '#DC2626' // red-600
    case 'HIGH': return '#EA580C' // orange-600
    case 'LIMITED': return '#CA8A04' // yellow-600
    case 'MINIMAL': return '#16A34A' // green-600
    case 'UNKNOWN': return '#6B7280' // gray-500
  }
}

export function getRiskLevelDescription(level: RiskLevel): string {
  switch (level) {
    case 'PROHIBITED':
      return 'This AI system falls under prohibited practices defined in Article 5 of the EU AI Act and cannot be deployed in the EU.'
    case 'HIGH':
      return 'This AI system is classified as high-risk under Annex III and must comply with strict requirements before market placement.'
    case 'LIMITED':
      return 'This AI system has transparency obligations under Article 50 but no other specific requirements.'
    case 'MINIMAL':
      return 'This AI system has no specific obligations under the EU AI Act beyond voluntary codes of conduct.'
    case 'UNKNOWN':
      return 'Risk level has not been assessed yet.'
  }
}
