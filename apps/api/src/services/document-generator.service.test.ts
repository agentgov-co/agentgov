import { describe, it, expect } from 'vitest'
import { generateDocument } from './document-generator.service.js'
import type { AISystem } from '../generated/prisma/client.js'

// Minimal AISystem factory for tests
function createMockSystem(overrides: Partial<AISystem> = {}): AISystem {
  return {
    id: 'sys_test123',
    name: 'Test AI System',
    description: 'A test system',
    version: '1.0',
    projectId: 'proj_test',
    riskLevel: 'HIGH',
    complianceStatus: 'IN_PROGRESS',
    intendedPurpose: 'Automated applicant screening',
    deployedInEU: true,
    affectsEUCitizens: true,
    annexIIICategory: 'employment',
    applicableArticles: ['Article 6', 'Article 9'],
    wizardData: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  } as AISystem
}

describe('Document Generator Service', () => {
  const generatedAt = new Date('2025-06-01T00:00:00Z')

  describe('generateDocument', () => {
    it('should generate TECHNICAL_DOCUMENTATION', () => {
      const result = generateDocument('TECHNICAL_DOCUMENTATION', {
        system: createMockSystem(),
        generatedAt,
      })

      expect(result.type).toBe('TECHNICAL_DOCUMENTATION')
      expect(result.title).toContain('Technical Documentation')
      expect(result.content).toContain('Test AI System')
      expect(result.generatedFrom).toBeDefined()
    })

    it('should generate FRIA document', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem(),
        generatedAt,
      })

      expect(result.type).toBe('FRIA')
      expect(result.title).toContain('Fundamental Rights Impact Assessment')
      expect(result.content).toContain('Fundamental Rights Impact Assessment')
      expect(result.content).toContain('Test AI System')
    })

    it('should include deployer FRIA assessment when wizard data has FRIA fields', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            processesPersonalData: true,
            processesSensitiveData: false,
            usesProfilingOrScoring: true,
            hasLegalEffects: true,
            affectsVulnerableGroups: false,
            friaAffectedGroups: 'Job applicants aged 18-65',
            friaPotentialDiscrimination: 'Age bias in CV parsing algorithm',
            friaFundamentalRightsImpact: 'Impacts right to non-discrimination in employment',
            friaMitigationMeasures: 'Regular bias audits, human review of rejections',
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      expect(result.content).toContain("Deployer's FRIA Assessment")
      expect(result.content).toContain('Job applicants aged 18-65')
      expect(result.content).toContain('Age bias in CV parsing algorithm')
      expect(result.content).toContain('Impacts right to non-discrimination in employment')
      expect(result.content).toContain('Regular bias audits, human review of rejections')
    })

    it('should omit deployer FRIA section when no FRIA wizard data provided', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            processesPersonalData: true,
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      expect(result.content).not.toContain("Deployer's FRIA Assessment")
    })

    it('should include partial FRIA section with only affectedGroups', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            friaAffectedGroups: 'All EU citizens using the service',
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      expect(result.content).toContain("Deployer's FRIA Assessment")
      expect(result.content).toContain('All EU citizens using the service')
      expect(result.content).not.toContain('Potential Discrimination Risks')
      expect(result.content).not.toContain('Proposed Mitigation Measures')
    })

    it('should generate all document types without error', () => {
      const types = [
        'TECHNICAL_DOCUMENTATION',
        'RISK_MANAGEMENT',
        'DATA_GOVERNANCE',
        'HUMAN_OVERSIGHT',
        'CONFORMITY_DECLARATION',
        'FRIA',
        'TRANSPARENCY_NOTICE',
        'INCIDENT_REPORT',
        'POST_MARKET_MONITORING',
      ] as const

      for (const type of types) {
        const result = generateDocument(type, {
          system: createMockSystem(),
          generatedAt,
        })

        expect(result.type).toBe(type)
        expect(result.title).toBeTruthy()
        expect(result.content).toBeTruthy()
        expect(result.generatedFrom).toBeDefined()
      }
    })

    it('should include system details in generatedFrom', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem(),
        generatedAt,
      })

      expect(result.generatedFrom).toHaveProperty('systemId', 'sys_test123')
      expect(result.generatedFrom).toHaveProperty('systemName', 'Test AI System')
    })
  })

  describe('FRIA Markdown Structure', () => {
    it('should have correct section ordering', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            processesPersonalData: true,
            hasLegalEffects: true,
            friaAffectedGroups: 'Test groups',
            friaFundamentalRightsImpact: 'Test impact',
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      const content = result.content

      // Verify major sections appear in correct order
      const sectionOrder = [
        '## 1. System Overview',
        '### 1.1 Purpose',
        '### 1.2 Deployment Context',
        '### 1.3 Annex III Category',
        "### 1.4 Deployer's FRIA Assessment",
        '## 2. Fundamental Rights Assessment Matrix',
        '### 2.1 Right to Human Dignity',
        '### 2.2 Right to Non-Discrimination',
      ]

      let lastIndex = -1
      for (const section of sectionOrder) {
        const index = content.indexOf(section)
        expect(index, `Section "${section}" should exist in content`).toBeGreaterThan(-1)
        expect(index, `Section "${section}" should appear after previous section`).toBeGreaterThan(lastIndex)
        lastIndex = index
      }
    })

    it('should have valid Markdown table in deployment context', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem(),
        generatedAt,
      })

      // Verify the deployment context table has proper structure
      const content = result.content
      expect(content).toContain('| Aspect | Value | Implication |')
      expect(content).toContain('|--------|-------|-------------|')
      expect(content).toContain('| Deployment Area |')
      expect(content).toContain('| Affects EU Citizens |')
    })

    it('should include document reference ID', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({ id: 'sys_abcdef12' }),
        generatedAt,
      })

      expect(result.content).toContain('FRIA-SYS_ABCD')
    })

    it('should adapt risk levels based on wizard data', () => {
      const highRiskResult = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            processesPersonalData: true,
            processesSensitiveData: true,
            usesProfilingOrScoring: true,
            hasLegalEffects: true,
            affectsVulnerableGroups: true,
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      // Sensitive data → High privacy risk
      expect(highRiskResult.content).toContain('**Pre-Assessment Risk Level:** High')
      // Profiling → High discrimination risk
      expect(highRiskResult.content).toMatch(/Non-Discrimination[\s\S]*?Pre-Assessment Risk Level:\*\* High/)

      const lowRiskResult = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            processesPersonalData: false,
            processesSensitiveData: false,
            usesProfilingOrScoring: false,
            hasLegalEffects: false,
            affectsVulnerableGroups: false,
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      expect(lowRiskResult.content).toContain('**Pre-Assessment Risk Level:** Low')
    })

    it('should include FRIA-specific wizard sections in correct order within 1.4', () => {
      const result = generateDocument('FRIA', {
        system: createMockSystem({
          wizardData: {
            friaAffectedGroups: 'Affected groups text',
            friaPotentialDiscrimination: 'Discrimination text',
            friaFundamentalRightsImpact: 'Rights impact text',
            friaMitigationMeasures: 'Mitigation text',
          } as unknown as AISystem['wizardData'],
        }),
        generatedAt,
      })

      const content = result.content

      const affectedIdx = content.indexOf('**Affected Population Groups:**')
      const rightsIdx = content.indexOf('**Fundamental Rights Impact Analysis:**')
      const discrimIdx = content.indexOf('**Potential Discrimination Risks:**')
      const mitigationIdx = content.indexOf('**Proposed Mitigation Measures:**')

      expect(affectedIdx).toBeGreaterThan(-1)
      expect(rightsIdx).toBeGreaterThan(affectedIdx)
      expect(discrimIdx).toBeGreaterThan(rightsIdx)
      expect(mitigationIdx).toBeGreaterThan(discrimIdx)
    })
  })
})
