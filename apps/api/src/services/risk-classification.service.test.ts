import { describe, it, expect } from 'vitest'
import {
  classifyRisk,
  ANNEX_III_CATEGORIES,
  getRiskLevelColor,
  getRiskLevelDescription
} from './risk-classification.service.js'
import type { AssessmentWizardData } from '../schemas/compliance.schema.js'

// Helper to create wizard data with defaults
function createWizardData(overrides: Partial<AssessmentWizardData> = {}): AssessmentWizardData {
  return {
    name: 'Test AI System',
    projectId: 'proj_123',
    useCaseDescription: 'A test AI system',
    annexIIICategory: null,
    deployedInEU: true,
    affectsEUCitizens: true,
    intendedPurpose: 'Testing purposes',
    processesPersonalData: false,
    usesBiometricIdentification: false,
    usesSocialScoring: false,
    usesEmotionRecognition: false,
    usesPredictivePolicing: false,
    usesSubliminalManipulation: false,
    exploitsVulnerabilities: false,
    processesSensitiveData: false,
    usesProfilingOrScoring: false,
    hasLegalEffects: false,
    hasSafetyImpact: false,
    affectsVulnerableGroups: false,
    deploymentScale: 'limited',
    automationLevel: 'human_assisted', // Default to human_assisted to avoid LIMITED triggers
    dataCategories: [],
    ...overrides,
  }
}

describe('Risk Classification Service', () => {
  describe('classifyRisk', () => {
    describe('PROHIBITED classification (Article 5)', () => {
      it('should classify social scoring as PROHIBITED', () => {
        const data = createWizardData({ usesSocialScoring: true })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('social scoring')
        expect(result.applicableArticles).toContain('Article 5')
      })

      it('should classify subliminal manipulation as PROHIBITED', () => {
        const data = createWizardData({ usesSubliminalManipulation: true })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('subliminal manipulation')
      })

      it('should classify exploitation of vulnerabilities as PROHIBITED', () => {
        const data = createWizardData({ exploitsVulnerabilities: true })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('vulnerabilities')
      })

      it('should classify real-time biometric ID for law enforcement as PROHIBITED', () => {
        const data = createWizardData({
          usesBiometricIdentification: true,
          annexIIICategory: 'law_enforcement',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('biometric identification')
      })

      it('should classify predictive policing for law enforcement as PROHIBITED', () => {
        const data = createWizardData({
          usesPredictivePolicing: true,
          annexIIICategory: 'law_enforcement',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('predictive policing')
      })

      it('should classify emotion recognition at workplace as PROHIBITED', () => {
        const data = createWizardData({
          usesEmotionRecognition: true,
          annexIIICategory: 'employment',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('emotion recognition')
      })

      it('should classify emotion recognition in education as PROHIBITED', () => {
        const data = createWizardData({
          usesEmotionRecognition: true,
          annexIIICategory: 'education',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.prohibitedReason).toContain('emotion recognition')
      })

      it('should return empty obligations for PROHIBITED systems', () => {
        const data = createWizardData({ usesSocialScoring: true })
        const result = classifyRisk(data)

        expect(result.obligations).toHaveLength(0)
      })

      it('should detect multiple prohibited uses', () => {
        const data = createWizardData({
          usesSocialScoring: true,
          usesSubliminalManipulation: true,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
        expect(result.reasoning.length).toBeGreaterThan(1)
      })
    })

    describe('HIGH risk classification (Annex III)', () => {
      it.each([
        'biometrics',
        'critical_infrastructure',
        'education',
        'employment',
        'essential_services',
        'migration',
        'justice',
      ] as const)('should classify %s category as HIGH risk', (category) => {
        const data = createWizardData({ annexIIICategory: category })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
        expect(result.annexIIICategory).toBe(category)
      })

      // Law enforcement without prohibited uses should be HIGH
      it('should classify law_enforcement category as HIGH risk (without prohibited flags)', () => {
        const data = createWizardData({
          annexIIICategory: 'law_enforcement',
          usesBiometricIdentification: false,
          usesPredictivePolicing: false,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
        expect(result.annexIIICategory).toBe('law_enforcement')
      })

      it('should include all required articles for HIGH risk', () => {
        const data = createWizardData({ annexIIICategory: 'employment' })
        const result = classifyRisk(data)

        expect(result.applicableArticles).toContain('Article 9') // Risk Management
        expect(result.applicableArticles).toContain('Article 10') // Data Governance
        expect(result.applicableArticles).toContain('Article 11') // Technical Documentation
        expect(result.applicableArticles).toContain('Article 12') // Record Keeping
        expect(result.applicableArticles).toContain('Article 13') // Transparency
        expect(result.applicableArticles).toContain('Article 14') // Human Oversight
        expect(result.applicableArticles).toContain('Article 15') // Accuracy/Robustness
        expect(result.applicableArticles).toContain('Article 43') // Conformity Assessment
        expect(result.applicableArticles).toContain('Article 47') // EU Declaration
        expect(result.applicableArticles).toContain('Article 49') // Registration
        expect(result.applicableArticles).toContain('Article 72') // Post-Market
        expect(result.applicableArticles).toContain('Article 62') // Incident Reporting
      })

      it('should generate 12 obligations for HIGH risk', () => {
        const data = createWizardData({ annexIIICategory: 'employment' })
        const result = classifyRisk(data)

        expect(result.obligations.length).toBe(12)
        expect(result.obligations.map(o => o.articleNumber)).toContain('Article 9')
        expect(result.obligations.map(o => o.articleNumber)).toContain('Article 14')
      })

      it('should classify fully automated system with legal effects as HIGH risk', () => {
        const data = createWizardData({
          hasLegalEffects: true,
          automationLevel: 'fully_automated',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should classify system with safety impact as HIGH risk', () => {
        const data = createWizardData({ hasSafetyImpact: true })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should classify mass-scale sensitive data processing as HIGH risk', () => {
        const data = createWizardData({
          processesSensitiveData: true,
          deploymentScale: 'mass',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should classify vulnerable groups with legal impact as HIGH risk', () => {
        const data = createWizardData({
          affectsVulnerableGroups: true,
          hasLegalEffects: true,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should classify vulnerable groups with safety impact as HIGH risk', () => {
        const data = createWizardData({
          affectsVulnerableGroups: true,
          hasSafetyImpact: true,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should classify profiling with legal effects as HIGH risk', () => {
        const data = createWizardData({
          usesProfilingOrScoring: true,
          hasLegalEffects: true,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })
    })

    describe('LIMITED risk classification (Article 50)', () => {
      it('should classify semi-automated AI as LIMITED risk', () => {
        const data = createWizardData({
          automationLevel: 'semi_automated',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
        expect(result.applicableArticles).toContain('Article 50')
      })

      it('should classify fully-automated AI as LIMITED risk', () => {
        const data = createWizardData({
          automationLevel: 'fully_automated',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
        expect(result.applicableArticles).toContain('Article 50')
      })

      it('should classify content generation system as LIMITED risk', () => {
        const data = createWizardData({
          useCaseDescription: 'AI system that generates synthetic images',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
      })

      it('should classify deepfake system as LIMITED risk', () => {
        const data = createWizardData({
          useCaseDescription: 'Deepfake video creation tool',
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
      })

      it('should classify emotion recognition (non-prohibited context) as LIMITED', () => {
        const data = createWizardData({
          usesEmotionRecognition: true,
          annexIIICategory: null, // Not employment or education
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
      })

      it('should classify biometric categorization (non-law enforcement) as LIMITED', () => {
        const data = createWizardData({
          usesBiometricIdentification: true,
          annexIIICategory: null, // Not law enforcement
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('LIMITED')
      })

      it('should generate 1 obligation (transparency) for LIMITED risk', () => {
        const data = createWizardData({
          automationLevel: 'semi_automated',
        })
        const result = classifyRisk(data)

        expect(result.obligations.length).toBe(1)
        expect(result.obligations[0].articleNumber).toBe('Article 50')
        expect(result.obligations[0].articleTitle).toContain('Transparency')
      })
    })

    describe('MINIMAL risk classification', () => {
      it('should classify system outside EU scope as MINIMAL', () => {
        const data = createWizardData({
          deployedInEU: false,
          affectsEUCitizens: false,
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('MINIMAL')
        expect(result.applicableArticles).toHaveLength(0)
        expect(result.obligations).toHaveLength(0)
      })

      it('should classify pure human-assisted system without triggers as MINIMAL', () => {
        const data = createWizardData({
          automationLevel: 'human_assisted',
          useCaseDescription: 'Simple data analysis tool', // No synthetic/generation keywords
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('MINIMAL')
      })
    })

    describe('Edge cases and priority', () => {
      it('should prioritize PROHIBITED over HIGH risk', () => {
        const data = createWizardData({
          usesSocialScoring: true,
          annexIIICategory: 'essential_services', // Would be HIGH otherwise
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('PROHIBITED')
      })

      it('should prioritize HIGH (Annex III) over LIMITED risk', () => {
        const data = createWizardData({
          annexIIICategory: 'employment',
          automationLevel: 'semi_automated', // Would trigger LIMITED
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should prioritize HIGH (implicit factors) over LIMITED risk', () => {
        const data = createWizardData({
          hasSafetyImpact: true,
          automationLevel: 'semi_automated', // Would trigger LIMITED
        })
        const result = classifyRisk(data)

        expect(result.riskLevel).toBe('HIGH')
      })

      it('should handle system deployed in EU but not affecting EU citizens', () => {
        const data = createWizardData({
          deployedInEU: true,
          affectsEUCitizens: false,
          automationLevel: 'semi_automated',
        })
        const result = classifyRisk(data)

        // Should still be subject to EU AI Act if deployed in EU
        expect(result.riskLevel).toBe('LIMITED')
      })

      it('should handle system not deployed in EU but affecting EU citizens', () => {
        const data = createWizardData({
          deployedInEU: false,
          affectsEUCitizens: true,
          automationLevel: 'semi_automated',
        })
        const result = classifyRisk(data)

        // Should still be subject to EU AI Act if affects EU citizens
        expect(result.riskLevel).toBe('LIMITED')
      })
    })
  })

  describe('ANNEX_III_CATEGORIES', () => {
    it('should have 8 categories', () => {
      expect(Object.keys(ANNEX_III_CATEGORIES)).toHaveLength(8)
    })

    it('should have name, description, and examples for each category', () => {
      for (const [, value] of Object.entries(ANNEX_III_CATEGORIES)) {
        expect(value).toHaveProperty('name')
        expect(value).toHaveProperty('description')
        expect(value).toHaveProperty('examples')
        expect(Array.isArray(value.examples)).toBe(true)
        expect(value.examples.length).toBeGreaterThan(0)
      }
    })

    it.each([
      'biometrics',
      'critical_infrastructure',
      'education',
      'employment',
      'essential_services',
      'law_enforcement',
      'migration',
      'justice',
    ])('should have valid category: %s', (category) => {
      expect(ANNEX_III_CATEGORIES).toHaveProperty(category)
    })
  })

  describe('getRiskLevelColor', () => {
    it('should return red for PROHIBITED', () => {
      expect(getRiskLevelColor('PROHIBITED')).toBe('#DC2626')
    })

    it('should return orange for HIGH', () => {
      expect(getRiskLevelColor('HIGH')).toBe('#EA580C')
    })

    it('should return yellow for LIMITED', () => {
      expect(getRiskLevelColor('LIMITED')).toBe('#CA8A04')
    })

    it('should return green for MINIMAL', () => {
      expect(getRiskLevelColor('MINIMAL')).toBe('#16A34A')
    })

    it('should return gray for UNKNOWN', () => {
      expect(getRiskLevelColor('UNKNOWN')).toBe('#6B7280')
    })
  })

  describe('getRiskLevelDescription', () => {
    it('should return description for PROHIBITED', () => {
      const desc = getRiskLevelDescription('PROHIBITED')
      expect(desc).toContain('cannot be deployed')
    })

    it('should return description for HIGH', () => {
      const desc = getRiskLevelDescription('HIGH')
      expect(desc).toContain('high-risk')
    })

    it('should return description for LIMITED', () => {
      const desc = getRiskLevelDescription('LIMITED')
      expect(desc).toContain('transparency')
    })

    it('should return description for MINIMAL', () => {
      const desc = getRiskLevelDescription('MINIMAL')
      expect(desc).toContain('no specific obligations')
    })

    it('should return description for UNKNOWN', () => {
      const desc = getRiskLevelDescription('UNKNOWN')
      expect(desc).toContain('not been assessed')
    })
  })
})
