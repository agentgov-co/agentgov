import type { DocumentType } from '../schemas/compliance.schema.js'
import type { AISystem, HumanOversightConfig } from '../generated/prisma/client.js'

// ============================================
// Document Templates
// ============================================

interface DocumentContext {
  system: AISystem
  oversightConfig?: HumanOversightConfig | null
  generatedAt: Date
}

export interface GeneratedDocument {
  title: string
  content: string
  type: DocumentType
  generatedFrom: Record<string, unknown>
}

// ============================================
// Main Generator Function
// ============================================

export function generateDocument(
  type: DocumentType,
  context: DocumentContext
): GeneratedDocument {
  const { system, oversightConfig, generatedAt } = context

  const generators: Record<DocumentType, () => GeneratedDocument> = {
    TECHNICAL_DOCUMENTATION: () => generateTechnicalDocumentation(system, generatedAt),
    RISK_MANAGEMENT: () => generateRiskManagementDoc(system, generatedAt),
    DATA_GOVERNANCE: () => generateDataGovernanceDoc(system, generatedAt),
    HUMAN_OVERSIGHT: () => generateHumanOversightDoc(system, oversightConfig, generatedAt),
    CONFORMITY_DECLARATION: () => generateConformityDeclaration(system, generatedAt),
    FRIA: () => generateFRIA(system, generatedAt),
    TRANSPARENCY_NOTICE: () => generateTransparencyNotice(system, generatedAt),
    INCIDENT_REPORT: () => generateIncidentReportTemplate(system, generatedAt),
    POST_MARKET_MONITORING: () => generatePostMarketPlan(system, generatedAt)
  }

  return generators[type]()
}

// ============================================
// Technical Documentation (Article 11)
// ============================================

function generateTechnicalDocumentation(system: AISystem, generatedAt: Date): GeneratedDocument {
  const wizardData = system.wizardData as Record<string, unknown> | null
  const automationLevel = wizardData?.automationLevel as string || 'semi_automated'
  const deploymentScale = wizardData?.deploymentScale as string || 'limited'
  const dataCategories = wizardData?.dataCategories as string[] || []

  const content = `# Technical Documentation

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}
**Risk Level:** ${system.riskLevel}
**Document Reference:** TD-${system.id.slice(0, 8).toUpperCase()}

---

## 1. General Description

### 1.1 System Name and Identification
- **Name:** ${system.name}
- **Unique Identifier:** ${system.id}
- **Version:** ${system.version || '1.0'}
- **Description:** ${system.description || 'No description provided'}

### 1.2 Intended Purpose
${system.intendedPurpose || 'Not specified'}

### 1.3 Intended Users
${system.intendedUsers || 'General users - to be specified by deployer'}

### 1.4 Use Case Description
${wizardData?.useCaseDescription || 'See intended purpose above'}

---

## 2. System Characteristics

### 2.1 Risk Classification
- **Risk Level:** ${system.riskLevel}
- **Annex III Category:** ${formatAnnexIIICategory(system.annexIIICategory)}
${system.prohibitedReason ? `- **⚠️ Prohibited Reason:** ${system.prohibitedReason}` : ''}

### 2.2 Deployment Context
- **Deployed in EU:** ${system.deployedInEU ? 'Yes' : 'No'}
- **Affects EU Citizens:** ${system.affectsEUCitizens ? 'Yes' : 'No'}
- **Deployment Scale:** ${formatDeploymentScale(deploymentScale)}

### 2.3 Automation Level
- **Level:** ${formatAutomationLevel(automationLevel)}
- **Human Involvement:** ${getHumanInvolvementDescription(automationLevel)}

### 2.4 Classification Reasoning
${system.riskReasoning || 'See assessment details'}

---

## 3. Technical Specifications

### 3.1 Architecture Overview

**Required Information:**
1. **Model Type:** Document the underlying AI/ML model architecture (e.g., neural network, decision tree, ensemble)
2. **Components:** List all major system components and their interactions
3. **External Dependencies:** Document third-party services, APIs, or models used
4. **Infrastructure:** Describe hosting environment and computational resources

**Architecture Diagram:**
\`\`\`
[Insert architecture diagram here]
\`\`\`

### 3.2 Input/Output Specifications

**Input Specification:**
| Input Type | Format | Constraints | Validation |
|------------|--------|-------------|------------|
| [e.g., Text] | [e.g., UTF-8 string] | [e.g., Max 4096 chars] | [Validation rules] |

**Output Specification:**
| Output Type | Format | Range/Constraints |
|-------------|--------|-------------------|
| [e.g., Classification] | [e.g., JSON] | [e.g., confidence 0-1] |

### 3.3 Performance Metrics

**Key Performance Indicators:**
| Metric | Target | Measurement Method | Frequency |
|--------|--------|-------------------|-----------|
| Accuracy | ≥ [X]% | Cross-validation | Monthly |
| Precision | ≥ [X]% | Test set evaluation | Monthly |
| Recall | ≥ [X]% | Test set evaluation | Monthly |
| Latency (P95) | < [X]ms | Runtime monitoring | Real-time |
| Availability | ≥ 99.9% | Uptime monitoring | Daily |

### 3.4 System Limitations

**Known Limitations:**
- Describe scenarios where the system may perform poorly
- Document edge cases and boundary conditions
- List any input types that are not supported

**Intended Operating Conditions:**
- Define the environmental conditions for proper operation
- Specify required computational resources
- Note any geographic or language limitations

---

## 4. Data Requirements

### 4.1 Training Data

**Data Sources:**
| Source | Type | Size | Collection Method |
|--------|------|------|-------------------|
| [Source 1] | [Type] | [N records] | [Method] |

**Data Characteristics:**
- **Time Period:** [Start date] to [End date]
- **Geographic Coverage:** [Regions/Countries]
- **Representativeness:** [Describe how data represents intended population]

### 4.2 Validation Data

**Validation Approach:**
- **Validation Set Size:** [X]% of total data
- **Stratification:** [Describe stratification strategy]
- **Holdout Method:** [e.g., k-fold cross-validation]

**Validation Results:**
| Metric | Training | Validation | Test |
|--------|----------|------------|------|
| Accuracy | | | |
| AUC-ROC | | | |

### 4.3 Data Quality Measures

**Quality Assurance Process:**
1. **Data Cleaning:** [Describe cleaning procedures]
2. **Missing Values:** [Strategy for handling missing data]
3. **Outlier Detection:** [Method for identifying outliers]
4. **Consistency Checks:** [Validation rules applied]

**Data Categories Processed:**
${dataCategories.length > 0 ? dataCategories.map(c => `- ${c}`).join('\n') : '- Standard non-sensitive data'}

---

## 5. Human Oversight Measures

### 5.1 Oversight Implementation
${getOversightGuidance(system.riskLevel, automationLevel)}

### 5.2 Control Mechanisms
- **Interrupt Capability:** Operators can halt system operation
- **Override Capability:** Human decisions can supersede AI outputs
- **Shutdown Capability:** Emergency shutdown procedures in place

See Human Oversight Documentation (Document HO-${system.id.slice(0, 8).toUpperCase()}) for detailed procedures.

---

## 6. Logging and Monitoring

### 6.1 Automatic Logging
- **Input/Output Logging:** All inputs and outputs are logged with timestamps
- **Decision Logging:** Key decision points are recorded
- **Performance Logging:** Metrics collected at defined intervals

### 6.2 Retention Period
- **Operational Logs:** Minimum 10 years (per Article 12(2))
- **Incident Logs:** Indefinite retention for serious incidents

---

## 7. Compliance Information

### 7.1 Applicable EU AI Act Articles
${(system.applicableArticles || []).map(a => `- ${a}`).join('\n') || 'None specified'}

### 7.2 Harmonised Standards
[List applicable harmonised standards when adopted]

### 7.3 Conformity Assessment
${system.riskLevel === 'HIGH' ? '**Required:** Third-party conformity assessment required for this high-risk system.' : 'Self-assessment applies based on risk classification.'}

---

## 8. Cybersecurity

### 8.1 Security Measures
- **Access Control:** [Describe authentication/authorization]
- **Data Protection:** [Encryption at rest/in transit]
- **Audit Trail:** [Security event logging]

### 8.2 Resilience
- **Adversarial Testing:** [Describe robustness testing]
- **Failover Procedures:** [Backup and recovery]

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | ${generatedAt.toISOString().split('T')[0]} | AgentGov | Initial generation |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Compliance Officer | | | |
| Legal | | | |

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
*Document complies with Article 11 of Regulation (EU) 2024/1689.*
`

  return {
    title: `Technical Documentation - ${system.name}`,
    content,
    type: 'TECHNICAL_DOCUMENTATION',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      riskLevel: system.riskLevel,
      wizardData
    }
  }
}

// ============================================
// Risk Management (Article 9)
// ============================================

function generateRiskManagementDoc(system: AISystem, generatedAt: Date): GeneratedDocument {
  const wizardData = system.wizardData as Record<string, unknown> | null
  const hasSafetyImpact = wizardData?.hasSafetyImpact as boolean || false
  const affectsVulnerableGroups = wizardData?.affectsVulnerableGroups as boolean || false
  const hasLegalEffects = wizardData?.hasLegalEffects as boolean || false

  const content = `# Risk Management System

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}
**Risk Level:** ${system.riskLevel}
**Document Reference:** RM-${system.id.slice(0, 8).toUpperCase()}

---

## 1. Risk Management Process

### 1.1 Scope
This document describes the risk management system for the AI system "${system.name}" as required by Article 9 of the EU AI Act. The risk management system is an iterative process that runs throughout the entire lifecycle of the AI system.

### 1.2 Risk Management Lifecycle
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    CONTINUOUS PROCESS                        │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ IDENTIFY │ ANALYZE  │ EVALUATE │ MITIGATE │ MONITOR & REVIEW│
│  risks   │  risks   │  risks   │  risks   │   continuously  │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
\`\`\`

### 1.3 Risk Categories per EU AI Act
- **Health & Safety Risks** (persons' physical or mental health)
- **Fundamental Rights Risks** (EU Charter rights)
- **Environmental Risks** (where applicable)
- **Security Risks** (adversarial attacks, data breaches)

---

## 2. Initial Risk Assessment

### 2.1 System-Specific Risk Factors
Based on the assessment wizard data:

| Factor | Status | Risk Implication |
|--------|--------|------------------|
| Safety Impact | ${hasSafetyImpact ? '⚠️ Yes' : '✅ No'} | ${hasSafetyImpact ? 'Requires safety-specific controls' : 'Standard controls'} |
| Affects Vulnerable Groups | ${affectsVulnerableGroups ? '⚠️ Yes' : '✅ No'} | ${affectsVulnerableGroups ? 'Enhanced protections required' : 'Standard protections'} |
| Legal Effects | ${hasLegalEffects ? '⚠️ Yes' : '✅ No'} | ${hasLegalEffects ? 'Human review mandatory' : 'Standard oversight'} |
| Annex III Category | ${system.annexIIICategory || 'None'} | ${system.annexIIICategory ? 'High-risk classification triggers' : 'Lower risk profile'} |

---

## 2.2 Health & Safety Risks

**Risk Identification Checklist:**
- [ ] Physical harm to users or third parties
- [ ] Mental/psychological harm
- [ ] Harm from incorrect outputs being acted upon
- [ ] Harm from system failures or unavailability
- [ ] Long-term health effects

**Identified Risks:**

| Risk ID | Description | Likelihood | Impact | Risk Score | Priority |
|---------|-------------|------------|--------|------------|----------|
| HS-001 | ${hasSafetyImpact ? 'Safety-critical decision errors' : 'Incorrect output leading to user confusion'} | ${hasSafetyImpact ? 'Medium' : 'Low'} | ${hasSafetyImpact ? 'High' : 'Low'} | ${hasSafetyImpact ? '12' : '2'} | ${hasSafetyImpact ? 'High' : 'Low'} |
| HS-002 | System unavailability during critical operation | Low | Medium | 4 | Medium |
| HS-003 | [Add additional identified risks] | | | | |

*Risk Score = Likelihood (1-4) × Impact (1-4)*

### 2.3 Fundamental Rights Risks

**EU Charter Rights Assessment:**

| Right | Article | Potentially Affected | Risk Level | Justification |
|-------|---------|---------------------|------------|---------------|
| Human Dignity | Art. 1 | ${hasLegalEffects || affectsVulnerableGroups ? '⚠️ Yes' : 'No'} | ${hasLegalEffects || affectsVulnerableGroups ? 'Medium' : 'Low'} | |
| Non-Discrimination | Art. 21 | Review Required | Medium | AI systems require bias monitoring |
| Privacy | Art. 7 | ${wizardData?.processesPersonalData ? '⚠️ Yes' : 'No'} | ${wizardData?.processesPersonalData ? 'Medium' : 'Low'} | |
| Data Protection | Art. 8 | ${wizardData?.processesPersonalData ? '⚠️ Yes' : 'No'} | ${wizardData?.processesPersonalData ? 'Medium' : 'Low'} | |
| Freedom of Expression | Art. 11 | To Assess | | |
| Effective Remedy | Art. 47 | ${hasLegalEffects ? '⚠️ Yes' : 'No'} | ${hasLegalEffects ? 'High' : 'Low'} | |

### 2.4 Bias and Discrimination Risks

**Bias Assessment Matrix:**

| Bias Type | Source | Detection Method | Status |
|-----------|--------|------------------|--------|
| Selection Bias | Training data | Statistical analysis of data distribution | Pending |
| Confirmation Bias | Model design | Counterfactual testing | Pending |
| Historical Bias | Ground truth labels | Expert review | Pending |
| Measurement Bias | Data collection | Comparison across subgroups | Pending |
| Aggregation Bias | Model generalization | Disaggregated evaluation | Pending |

---

## 3. Risk Mitigation Measures

### 3.1 Technical Measures

| Measure ID | Measure | Target Risk | Implementation Status |
|------------|---------|-------------|----------------------|
| TM-001 | Input validation and sanitization | Data quality risks | ${system.complianceStatus === 'COMPLIANT' ? '✅ Implemented' : '🔄 Pending'} |
| TM-002 | Output confidence thresholds | False positive/negative risks | Pending |
| TM-003 | Anomaly detection on inputs | Out-of-distribution risks | Pending |
| TM-004 | Fallback mechanisms | System failure risks | Pending |
| TM-005 | Bias monitoring and alerting | Discrimination risks | Pending |
| TM-006 | Explainability features | Transparency risks | Pending |

### 3.2 Organizational Measures

| Measure ID | Measure | Target Risk | Owner | Status |
|------------|---------|-------------|-------|--------|
| OM-001 | Human oversight procedures | All risks | Operations | Pending |
| OM-002 | Incident response plan | Safety risks | Security | Pending |
| OM-003 | Regular bias audits | Discrimination risks | Compliance | Pending |
| OM-004 | User training program | Misuse risks | Training | Pending |
| OM-005 | Stakeholder feedback channels | Unidentified risks | Product | Pending |

### 3.3 Human Oversight Measures
See Human Oversight Documentation (HO-${system.id.slice(0, 8).toUpperCase()}).

---

## 4. Residual Risk Assessment

### 4.1 Acceptable Risk Criteria

**Risk Acceptance Matrix:**
| Risk Score | Category | Decision |
|------------|----------|----------|
| 1-4 | Low | Accept with monitoring |
| 5-8 | Medium | Accept with controls |
| 9-12 | High | Reduce before deployment |
| 13-16 | Critical | Not acceptable |

### 4.2 Residual Risk Summary

| Risk ID | Original Score | After Mitigation | Status |
|---------|----------------|------------------|--------|
| HS-001 | [X] | [Y] | [Accept/Reduce] |
| FR-001 | [X] | [Y] | [Accept/Reduce] |

**Overall Residual Risk Assessment:** [To be completed after mitigation implementation]

---

## 5. Risk Monitoring

### 5.1 Monitoring Procedures

**Real-Time Monitoring:**
- Performance metrics dashboards
- Anomaly detection alerts
- User feedback collection

**Periodic Assessments:**
- Monthly bias reports
- Quarterly risk reviews
- Annual comprehensive audit

### 5.2 Key Risk Indicators (KRIs)

| KRI | Threshold | Current | Trend |
|-----|-----------|---------|-------|
| Error rate | < 5% | - | - |
| Bias metric (demographic parity) | < 0.1 | - | - |
| User complaints rate | < 0.1% | - | - |
| Incident count | 0 critical | - | - |

### 5.3 Review Schedule

| Review Type | Frequency | Next Due | Responsible |
|-------------|-----------|----------|-------------|
| Operational Review | Monthly | [Date] | Operations |
| Bias Audit | Quarterly | [Date] | Compliance |
| Full Risk Assessment | Annual | [Date] | Risk Management |
| Post-Incident Review | Event-triggered | N/A | Incident Team |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | ${generatedAt.toISOString().split('T')[0]} | AgentGov | Initial generation |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Risk Manager | | | |
| Compliance Officer | | | |
| Technical Lead | | | |

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
*Document complies with Article 9 of Regulation (EU) 2024/1689.*
`

  return {
    title: `Risk Management System - ${system.name}`,
    content,
    type: 'RISK_MANAGEMENT',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      riskLevel: system.riskLevel
    }
  }
}

// ============================================
// Data Governance (Article 10)
// ============================================

function generateDataGovernanceDoc(system: AISystem, generatedAt: Date): GeneratedDocument {
  const wizardData = system.wizardData as Record<string, unknown> | null

  const content = `# Data Governance Documentation

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}

---

## 1. Data Governance Framework

### 1.1 Scope
This document describes data governance practices for "${system.name}" as required by Article 10 of the EU AI Act.

### 1.2 Personal Data Processing
- **Processes Personal Data:** ${wizardData?.processesPersonalData ? 'Yes' : 'No'}
- **Processes Sensitive Data:** ${wizardData?.processesSensitiveData ? 'Yes' : 'No'}

---

## 2. Training Data

### 2.1 Data Sources
[TO BE COMPLETED: List all training data sources]

### 2.2 Data Collection Methods
[TO BE COMPLETED: Describe how data was collected]

### 2.3 Data Relevance
[TO BE COMPLETED: Justify data relevance to intended purpose]

---

## 3. Data Quality

### 3.1 Quality Metrics
[TO BE COMPLETED: Define data quality metrics]

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Completeness | >95% | - | Pending |
| Accuracy | >98% | - | Pending |
| Consistency | >99% | - | Pending |

### 3.2 Quality Assurance Procedures
[TO BE COMPLETED: Describe QA procedures]

---

## 4. Bias Assessment

### 4.1 Bias Detection Methods
[TO BE COMPLETED: Describe bias detection approaches]

### 4.2 Identified Biases
[TO BE COMPLETED: Document any detected biases]

### 4.3 Bias Mitigation
[TO BE COMPLETED: Describe mitigation measures]

---

## 5. Data Protection

### 5.1 GDPR Compliance
[TO BE COMPLETED: Document GDPR compliance measures]

### 5.2 Data Security
[TO BE COMPLETED: Describe data security controls]

### 5.3 Data Retention
[TO BE COMPLETED: Define retention policies]

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | ${generatedAt.toISOString().split('T')[0]} | Initial generation |

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
`

  return {
    title: `Data Governance Documentation - ${system.name}`,
    content,
    type: 'DATA_GOVERNANCE',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      wizardData
    }
  }
}

// ============================================
// Human Oversight (Article 14)
// ============================================

function generateHumanOversightDoc(
  system: AISystem,
  config: HumanOversightConfig | null | undefined,
  generatedAt: Date
): GeneratedDocument {
  const content = `# Human Oversight Documentation

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}

---

## 1. Oversight Configuration

### 1.1 Oversight Level
- **Level:** ${config?.oversightLevel || 'monitoring'}
- **Human-in-the-Loop:** ${config?.humanInLoop ? 'Yes' : 'No'}
- **Human-on-the-Loop:** ${config?.humanOnLoop ? 'Yes' : 'No'}
- **Human-in-Command:** ${config?.humanInCommand ? 'Yes' : 'No'}

### 1.2 Control Mechanisms
- **Can Interrupt:** ${config?.canInterrupt ? 'Yes' : 'No'}
- **Can Override:** ${config?.canOverride ? 'Yes' : 'No'}
- **Can Shutdown:** ${config?.canShutdown ? 'Yes' : 'No'}

---

## 2. Monitoring

### 2.1 Monitoring Frequency
${config?.monitoringFrequency || 'Not configured'}

### 2.2 Alert Thresholds
${config?.alertThresholds ? JSON.stringify(config.alertThresholds, null, 2) : 'Not configured'}

---

## 3. Responsible Persons

${config?.responsiblePersons ? formatResponsiblePersons(config.responsiblePersons) : 'Not configured'}

---

## 4. Training Requirements

- **Training Required:** ${config?.trainingRequired ? 'Yes' : 'No'}
- **Training Completed:** ${config?.trainingCompleted ? 'Yes' : 'No'}
- **Procedure Documented:** ${config?.procedureDocumented ? 'Yes' : 'No'}

---

## 5. Oversight Procedures

### 5.1 Normal Operation
[TO BE COMPLETED: Describe oversight during normal operation]

### 5.2 Anomaly Detection
[TO BE COMPLETED: Describe how anomalies are detected and handled]

### 5.3 Incident Response
[TO BE COMPLETED: Describe incident response procedures]

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | ${generatedAt.toISOString().split('T')[0]} | Initial generation |

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
`

  return {
    title: `Human Oversight Documentation - ${system.name}`,
    content,
    type: 'HUMAN_OVERSIGHT',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      oversightConfig: config
    }
  }
}

function formatResponsiblePersons(persons: unknown): string {
  if (!Array.isArray(persons)) return 'Not configured'

  return persons.map((p: { name?: string; email?: string; role?: string }) =>
    `- **${p.name || 'Unknown'}** (${p.role || 'Role not specified'}) - ${p.email || 'No email'}`
  ).join('\n')
}

// ============================================
// Helper Functions for Document Generation
// ============================================

function formatAnnexIIICategory(category: string | null): string {
  const categoryNames: Record<string, string> = {
    biometrics: 'Biometric Identification & Categorisation (Annex III, 1)',
    critical_infrastructure: 'Critical Infrastructure (Annex III, 2)',
    education: 'Education & Vocational Training (Annex III, 3)',
    employment: 'Employment & Workers Management (Annex III, 4)',
    essential_services: 'Essential Private & Public Services (Annex III, 5)',
    law_enforcement: 'Law Enforcement (Annex III, 6)',
    migration: 'Migration, Asylum & Border Control (Annex III, 7)',
    justice: 'Administration of Justice (Annex III, 8)'
  }
  return category ? categoryNames[category] || category : 'N/A (Not a high-risk category)'
}

function formatDeploymentScale(scale: string): string {
  const scales: Record<string, string> = {
    prototype: 'Prototype (Internal testing only)',
    limited: 'Limited (Small-scale deployment)',
    wide: 'Wide (Organization-wide deployment)',
    mass: 'Mass Scale (Public-facing, large user base)'
  }
  return scales[scale] || scale
}

function formatAutomationLevel(level: string): string {
  const levels: Record<string, string> = {
    human_assisted: 'Human-Assisted (AI supports human decisions)',
    semi_automated: 'Semi-Automated (Shared human-AI decision making)',
    fully_automated: 'Fully Automated (AI makes decisions independently)'
  }
  return levels[level] || level
}

function getHumanInvolvementDescription(level: string): string {
  const descriptions: Record<string, string> = {
    human_assisted: 'Humans make all final decisions; AI provides recommendations and analysis only.',
    semi_automated: 'AI can make routine decisions; humans review edge cases and critical decisions.',
    fully_automated: 'AI operates autonomously within defined parameters; human oversight at monitoring level.'
  }
  return descriptions[level] || 'To be defined'
}

function getOversightGuidance(riskLevel: string, automationLevel: string): string {
  const automationNote = automationLevel === 'fully_automated'
    ? '\n\n**Note:** This system operates in fully automated mode. Enhanced oversight controls are critical.'
    : automationLevel === 'semi_automated'
    ? '\n\n**Note:** Semi-automated operation requires clear handoff procedures between AI and human decision-making.'
    : '\n\n**Note:** Human-assisted mode provides natural oversight through human decision-making.'

  if (riskLevel === 'HIGH') {
    return `**High-Risk System Requirements (Article 14):**
- Human oversight measures must be identified and built into the system
- Oversight must enable humans to:
  - Fully understand the system's capabilities and limitations
  - Properly monitor operation and detect anomalies
  - Interpret outputs correctly
  - Decide not to use the system or override/reverse outputs
  - Intervene or interrupt operation

**Recommended Implementation:**
- Real-time monitoring dashboard with alerting
- Clear documentation of override procedures
- Regular human review of system outputs
- Training program for oversight personnel${automationNote}`
  } else if (riskLevel === 'LIMITED') {
    return `**Limited Risk Requirements (Article 50):**
- Users must be informed they are interacting with an AI system
- Generated content must be marked as AI-generated
- Emotion recognition or biometric categorization must be disclosed

**Recommended Implementation:**
- Clear disclosure in user interface
- Metadata tagging for AI-generated content
- Documentation of transparency measures${automationNote}`
  }
  return `No specific oversight requirements under EU AI Act for this risk level.${automationNote}`
}

// ============================================
// Conformity Declaration (Article 47)
// ============================================

function generateConformityDeclaration(system: AISystem, generatedAt: Date): GeneratedDocument {
  const content = `# EU Declaration of Conformity

## AI System: ${system.name}

**Declaration Number:** [TO BE ASSIGNED]
**Date:** ${generatedAt.toISOString().split('T')[0]}

---

## 1. AI System Identification

- **Name:** ${system.name}
- **Version:** ${system.version || '1.0'}
- **Unique Identifier:** ${system.id}
- **Risk Level:** ${system.riskLevel}

---

## 2. Provider Information

- **Company Name:** [TO BE COMPLETED]
- **Address:** [TO BE COMPLETED]
- **Contact:** [TO BE COMPLETED]

---

## 3. Declaration

We hereby declare that the AI system identified above:

1. Has been designed and developed in compliance with the requirements of Regulation (EU) 2024/1689 (EU AI Act);

2. ${system.riskLevel === 'HIGH' ? 'Has undergone the applicable conformity assessment procedure' : 'Is not subject to conformity assessment requirements'};

3. Meets the applicable harmonised standards or common specifications;

4. Is accompanied by the required technical documentation;

5. Has appropriate human oversight measures in place.

---

## 4. Applicable Requirements

${(system.applicableArticles || []).map(a => `- ${a}`).join('\n') || 'No specific requirements applicable'}

---

## 5. Conformity Assessment

[TO BE COMPLETED: Reference to conformity assessment body if applicable]

---

## 6. Signature

**Signed for and on behalf of:**

Name: ________________________

Position: ________________________

Date: ________________________

Signature: ________________________

---

*This declaration is issued under the sole responsibility of the provider.*
`

  return {
    title: `EU Declaration of Conformity - ${system.name}`,
    content,
    type: 'CONFORMITY_DECLARATION',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      riskLevel: system.riskLevel,
      applicableArticles: system.applicableArticles
    }
  }
}

// ============================================
// FRIA - Fundamental Rights Impact Assessment
// ============================================

interface FriaWizardFields {
  affectedGroups: string
  potentialDiscrimination: string
  fundamentalRightsImpact: string
  mitigationMeasures: string
}

function buildFriaAssessmentSection(fria: FriaWizardFields): string {
  if (!fria.affectedGroups && !fria.fundamentalRightsImpact) {
    return ''
  }

  const sections: string[] = [
    '',
    '### 1.4 Deployer\'s FRIA Assessment',
    '',
    '**Affected Population Groups:**',
    fria.affectedGroups || 'Not specified',
    '',
    '**Fundamental Rights Impact Analysis:**',
    fria.fundamentalRightsImpact || 'Not specified',
  ]

  if (fria.potentialDiscrimination) {
    sections.push('', '**Potential Discrimination Risks:**', fria.potentialDiscrimination)
  }

  if (fria.mitigationMeasures) {
    sections.push('', '**Proposed Mitigation Measures:**', fria.mitigationMeasures)
  }

  sections.push('')
  return sections.join('\n')
}

function generateFRIA(system: AISystem, generatedAt: Date): GeneratedDocument {
  const wizardData = system.wizardData as Record<string, unknown> | null
  const processesPersonalData = wizardData?.processesPersonalData as boolean || false
  const processesSensitiveData = wizardData?.processesSensitiveData as boolean || false
  const usesProfilingOrScoring = wizardData?.usesProfilingOrScoring as boolean || false
  const hasLegalEffects = wizardData?.hasLegalEffects as boolean || false
  const affectsVulnerableGroups = wizardData?.affectsVulnerableGroups as boolean || false

  // FRIA-specific wizard data
  const friaAffectedGroups = wizardData?.friaAffectedGroups as string || ''
  const friaPotentialDiscrimination = wizardData?.friaPotentialDiscrimination as string || ''
  const friaFundamentalRightsImpact = wizardData?.friaFundamentalRightsImpact as string || ''
  const friaMitigationMeasures = wizardData?.friaMitigationMeasures as string || ''

  // Calculate initial risk indicators based on wizard data
  const dignityRisk = hasLegalEffects || affectsVulnerableGroups ? 'Medium' : 'Low'
  const discriminationRisk = usesProfilingOrScoring ? 'High' : 'Medium'
  const privacyRisk = processesSensitiveData ? 'High' : (processesPersonalData ? 'Medium' : 'Low')
  const dataProtectionRisk = processesPersonalData ? 'Medium' : 'Low'
  const effectiveRemedyRisk = hasLegalEffects ? 'High' : 'Low'

  const content = `# Fundamental Rights Impact Assessment (FRIA)

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}
**Document Reference:** FRIA-${system.id.slice(0, 8).toUpperCase()}
**Risk Classification:** ${system.riskLevel}

---

## 1. System Overview

### 1.1 Purpose
${system.intendedPurpose || 'Not specified'}

### 1.2 Deployment Context
| Aspect | Value | Implication |
|--------|-------|-------------|
| Deployment Area | ${system.deployedInEU ? 'European Union' : 'Outside EU'} | ${system.deployedInEU ? 'Full EU AI Act applicability' : 'Limited territorial scope'} |
| Affects EU Citizens | ${system.affectsEUCitizens ? 'Yes' : 'No'} | ${system.affectsEUCitizens ? 'EU fundamental rights apply' : 'Reduced rights obligations'} |
| Affects Vulnerable Groups | ${affectsVulnerableGroups ? 'Yes' : 'No'} | ${affectsVulnerableGroups ? '⚠️ Enhanced protections required' : 'Standard protections'} |
| Processes Personal Data | ${processesPersonalData ? 'Yes' : 'No'} | ${processesPersonalData ? 'GDPR compliance required' : 'Limited data protection scope'} |
| Has Legal Effects | ${hasLegalEffects ? 'Yes' : 'No'} | ${hasLegalEffects ? '⚠️ Human review mandatory' : 'Standard procedures'} |

### 1.3 Annex III Category
${formatAnnexIIICategory(system.annexIIICategory)}
${buildFriaAssessmentSection({ affectedGroups: friaAffectedGroups, potentialDiscrimination: friaPotentialDiscrimination, fundamentalRightsImpact: friaFundamentalRightsImpact, mitigationMeasures: friaMitigationMeasures })}
---

## 2. Fundamental Rights Assessment Matrix

### 2.1 Right to Human Dignity (Article 1 EU Charter)

**Pre-Assessment Risk Level:** ${dignityRisk}

**Assessment Questions:**
- [ ] Does the system make autonomous decisions about individuals?
- [ ] Could system outputs affect a person's sense of worth or self-determination?
- [ ] Are there mechanisms to ensure respectful treatment of all users?
- [ ] Is there transparency about the role of AI in decision-making?

**Analysis:**
${hasLegalEffects ?
  'This system has legal effects on individuals. Dignity impact must be carefully assessed as automated decisions may affect individuals\' autonomy and self-determination.' :
  'The system does not directly produce legal effects. Focus assessment on potential indirect impacts on human dignity through system outputs.'}

**Mitigation Measures:**
1. Ensure transparency about AI involvement in processes
2. Provide meaningful human oversight for significant decisions
3. Implement appeals and review mechanisms
4. Regular dignity impact monitoring

---

### 2.2 Right to Non-Discrimination (Article 21 EU Charter)

**Pre-Assessment Risk Level:** ${discriminationRisk}

**Protected Characteristics to Evaluate:**
| Characteristic | Risk Assessment | Testing Conducted | Status |
|---------------|-----------------|-------------------|--------|
| Sex/Gender | Pending | [ ] Yes [ ] No | |
| Race/Ethnicity | Pending | [ ] Yes [ ] No | |
| Age | Pending | [ ] Yes [ ] No | |
| Disability | Pending | [ ] Yes [ ] No | |
| Religion | Pending | [ ] Yes [ ] No | |
| Sexual Orientation | Pending | [ ] Yes [ ] No | |
| Nationality | Pending | [ ] Yes [ ] No | |

**Analysis:**
${usesProfilingOrScoring ?
  '⚠️ **High Risk:** This system uses profiling or scoring. Bias testing is mandatory across all protected characteristics. Document fairness metrics and demographic parity analysis.' :
  'Standard bias assessment required. Document training data composition and evaluation metrics disaggregated by protected characteristics.'}

**Mitigation Measures:**
1. Conduct bias audits before deployment and periodically after
2. Ensure training data representativeness
3. Implement fairness constraints in model design
4. Monitor for discriminatory outcomes in production
5. Establish reporting mechanism for discrimination complaints

---

### 2.3 Right to Privacy (Article 7 EU Charter)

**Pre-Assessment Risk Level:** ${privacyRisk}

**Privacy Impact Factors:**
| Factor | Status | Notes |
|--------|--------|-------|
| Collects personal data | ${processesPersonalData ? '⚠️ Yes' : 'No'} | |
| Processes sensitive data | ${processesSensitiveData ? '⚠️ Yes' : 'No'} | |
| Profiling activities | ${usesProfilingOrScoring ? '⚠️ Yes' : 'No'} | |
| Data retention period | To be specified | |
| Third-party data sharing | To be specified | |

**Analysis:**
${processesSensitiveData ?
  '⚠️ **High Risk:** The system processes sensitive personal data (special categories under GDPR Article 9). Enhanced privacy safeguards and explicit consent mechanisms required.' :
  (processesPersonalData ?
    'The system processes personal data. Standard GDPR privacy protections apply. Document lawful basis for processing.' :
    'Minimal personal data processing. Maintain documentation of data flows to verify no indirect privacy impacts.')}

**Mitigation Measures:**
1. Privacy by design implementation
2. Data minimization practices
3. Pseudonymization/anonymization where feasible
4. Clear privacy notice to users
5. Data subject rights procedures (access, rectification, erasure)

---

### 2.4 Right to Data Protection (Article 8 EU Charter)

**Pre-Assessment Risk Level:** ${dataProtectionRisk}

**GDPR Compliance Checklist:**
- [ ] Lawful basis for processing identified (Art. 6)
- [ ] Special category data basis if applicable (Art. 9)
- [ ] Data Protection Impact Assessment conducted if required (Art. 35)
- [ ] Records of processing activities maintained (Art. 30)
- [ ] Data subject rights procedures implemented (Arts. 15-22)
- [ ] Data breach notification procedures in place (Arts. 33-34)
- [ ] International transfer safeguards if applicable (Ch. V)

**Analysis:**
${processesPersonalData ?
  'Personal data processing requires documented GDPR compliance. Ensure all processing activities have identified lawful basis.' :
  'Limited personal data processing scope. Document any incidental data processing and ensure compliance.'}

---

### 2.5 Freedom of Expression (Article 11 EU Charter)

**Pre-Assessment Risk Level:** Low

**Assessment Questions:**
- [ ] Could the system restrict or filter user expression?
- [ ] Does the system moderate or curate content?
- [ ] Could outputs influence users' ability to express opinions?
- [ ] Are there risks of chilling effects on expression?

**Analysis:**
Assess whether the system's operation could directly or indirectly affect individuals' ability to freely express opinions or access information.

**Mitigation Measures:**
1. Avoid unnecessary content restrictions
2. Provide transparent content policies if applicable
3. Implement appeals for content decisions
4. Document any expression-limiting features

---

### 2.6 Right to an Effective Remedy (Article 47 EU Charter)

**Pre-Assessment Risk Level:** ${effectiveRemedyRisk}

**Remedy Mechanisms:**
| Mechanism | Available | Description |
|-----------|-----------|-------------|
| Human review | ${hasLegalEffects ? 'Required' : 'Recommended'} | |
| Appeal process | To implement | |
| Complaint handling | To implement | |
| External redress | To identify | |

**Analysis:**
${hasLegalEffects ?
  '⚠️ **High Risk:** The system has legal effects on individuals. Robust remedy mechanisms are mandatory. All affected individuals must have clear pathways to challenge AI-assisted decisions.' :
  'Standard remedy provisions apply. Ensure users can report issues and receive meaningful responses.'}

**Mitigation Measures:**
1. Clear documentation of decision-making process
2. Accessible human review mechanism
3. Defined timeline for complaint resolution
4. Information about external remedies (DPA, courts)
5. Regular audit of remedy effectiveness

---

## 3. Vulnerable Groups Assessment

### 3.1 Potentially Affected Vulnerable Groups

${affectsVulnerableGroups ? `
**Identified Groups Requiring Enhanced Protection:**

| Group | Reason for Vulnerability | Enhanced Safeguards |
|-------|-------------------------|---------------------|
| Children | Limited capacity to consent/understand | Age verification, parental controls |
| Elderly | Digital literacy challenges | Accessibility features, human alternatives |
| Persons with disabilities | Accessibility barriers | WCAG compliance, assistive tech support |
| Economically disadvantaged | Limited alternatives | Non-digital options, cost considerations |
| Migrants/Refugees | Language/cultural barriers | Multilingual support, cultural sensitivity |

**Assessment Requirement:** Each identified group must have specific risk mitigation documented.
` : `
**Assessment:** Based on initial screening, no specific vulnerable groups have been identified as particularly affected by this system. However, general accessibility and inclusivity best practices should still be applied.

**Standard considerations:**
- Accessibility features for users with disabilities
- Clear, simple language in user interfaces
- Alternative access methods where feasible
`}

### 3.2 Specific Risk Analysis

${affectsVulnerableGroups ?
  'Document specific risks for each identified vulnerable group. Consider cognitive, physical, economic, and social vulnerabilities.' :
  'No specific vulnerable group risks identified. Monitor for emerging patterns affecting any user groups.'}

### 3.3 Safeguards Matrix

| Safeguard | Implementation Status | Responsible Party |
|-----------|----------------------|-------------------|
| Accessibility compliance | Pending | |
| Alternative channels | Pending | |
| Support mechanisms | Pending | |
| Training for staff | Pending | |

---

## 4. Overall Assessment

### 4.1 Risk Summary Matrix

| Right | Risk Level | Mitigation Adequate | Residual Risk |
|-------|------------|---------------------|---------------|
| Human Dignity | ${dignityRisk} | Pending | Pending |
| Non-Discrimination | ${discriminationRisk} | Pending | Pending |
| Privacy | ${privacyRisk} | Pending | Pending |
| Data Protection | ${dataProtectionRisk} | Pending | Pending |
| Freedom of Expression | Low | Pending | Pending |
| Effective Remedy | ${effectiveRemedyRisk} | Pending | Pending |

### 4.2 Conclusion

**Overall Fundamental Rights Risk:** ${system.riskLevel === 'HIGH' ? 'Elevated - Enhanced safeguards required' : 'Standard - Implement documented mitigations'}

**Key Findings:**
1. ${processesPersonalData ? 'Personal data processing requires GDPR compliance verification' : 'Limited personal data processing reduces privacy risk'}
2. ${usesProfilingOrScoring ? 'Profiling activities require mandatory bias testing' : 'Standard bias monitoring recommended'}
3. ${hasLegalEffects ? 'Legal effects mandate human review mechanisms' : 'Standard remedy procedures apply'}
4. ${affectsVulnerableGroups ? 'Vulnerable group safeguards must be implemented' : 'General accessibility compliance applies'}

### 4.3 Recommendations

**Immediate Actions:**
1. Complete all pending assessments in this document
2. Implement identified mitigation measures
3. Establish monitoring mechanisms

**Ongoing Requirements:**
1. Quarterly fundamental rights review
2. Annual comprehensive FRIA update
3. Incident-triggered reassessment

---

## 5. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| FRIA Lead | | | |
| Legal Review | | | |
| Data Protection Officer | | | |
| Ethics Committee | | | |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | ${generatedAt.toISOString().split('T')[0]} | AgentGov | Initial generation |

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
*Complies with Fundamental Rights Impact Assessment requirements under the EU AI Act.*
`

  return {
    title: `Fundamental Rights Impact Assessment - ${system.name}`,
    content,
    type: 'FRIA',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      wizardData
    }
  }
}

// ============================================
// Transparency Notice (Article 50)
// ============================================

function generateTransparencyNotice(system: AISystem, generatedAt: Date): GeneratedDocument {
  const content = `# AI System Transparency Notice

## ${system.name}

**Effective Date:** ${generatedAt.toISOString().split('T')[0]}

---

## Notice to Users

**This service uses artificial intelligence.**

In compliance with Article 50 of the EU AI Act (Regulation 2024/1689), we inform you that:

### 1. AI System Information

- **System Name:** ${system.name}
- **Purpose:** ${system.intendedPurpose || 'Not specified'}
- **Provider:** [TO BE COMPLETED]

### 2. What This Means

You are interacting with an AI system. The responses, recommendations, or outputs you receive are generated by artificial intelligence technology, not by a human.

### 3. Your Rights

- You have the right to know when you are interacting with an AI system
- You may request human review of decisions that significantly affect you
- You may contact us for more information about the AI system

### 4. Limitations

[TO BE COMPLETED: Describe known limitations of the AI system]

### 5. Contact

For questions about this AI system, please contact:

[TO BE COMPLETED: Add contact information]

---

## For Synthetic Content

If this AI system generates or manipulates content (images, audio, video, text):

**Content generated or manipulated by this AI system is labeled as artificially generated or manipulated in accordance with Article 50(4) of the EU AI Act.**

---

*Last Updated: ${generatedAt.toISOString().split('T')[0]}*
`

  return {
    title: `Transparency Notice - ${system.name}`,
    content,
    type: 'TRANSPARENCY_NOTICE',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name,
      intendedPurpose: system.intendedPurpose
    }
  }
}

// ============================================
// Incident Report Template
// ============================================

function generateIncidentReportTemplate(system: AISystem, generatedAt: Date): GeneratedDocument {
  const content = `# Serious Incident Report Template

## AI System: ${system.name}

**Template Generated:** ${generatedAt.toISOString()}
**Reporting Deadline:** Within 15 days of becoming aware (per Article 62)

---

## 1. Incident Identification

- **Incident ID:** [AUTO-GENERATED]
- **Report Date:** [TO BE COMPLETED]
- **Reporter:** [TO BE COMPLETED]

---

## 2. AI System Information

- **System Name:** ${system.name}
- **System ID:** ${system.id}
- **Version:** ${system.version || '1.0'}
- **Risk Level:** ${system.riskLevel}

---

## 3. Incident Details

### 3.1 Description
[TO BE COMPLETED: Detailed description of the incident]

### 3.2 Timeline
- **Date/Time Occurred:** [TO BE COMPLETED]
- **Date/Time Detected:** [TO BE COMPLETED]
- **Date/Time Reported:** [TO BE COMPLETED]

### 3.3 Classification
- **Type:** [ ] Safety [ ] Fundamental Rights [ ] Malfunction [ ] Misuse [ ] Security [ ] Other
- **Severity:** [ ] Low [ ] Medium [ ] High [ ] Critical

---

## 4. Impact Assessment

### 4.1 Affected Parties
- **Number of Users Affected:** [TO BE COMPLETED]
- **Categories of Affected Persons:** [TO BE COMPLETED]

### 4.2 Harm Description
[TO BE COMPLETED: Describe the harm or potential harm]

### 4.3 Fundamental Rights Impact
[TO BE COMPLETED: Assess impact on fundamental rights]

---

## 5. Root Cause Analysis

### 5.1 Identified Cause
[TO BE COMPLETED: Describe the root cause]

### 5.2 Contributing Factors
[TO BE COMPLETED: List contributing factors]

---

## 6. Remediation

### 6.1 Immediate Actions Taken
[TO BE COMPLETED: List immediate remediation steps]

### 6.2 Long-term Corrective Actions
[TO BE COMPLETED: List planned corrective actions]

### 6.3 Preventive Measures
[TO BE COMPLETED: Describe measures to prevent recurrence]

---

## 7. Regulatory Notification

- **Notified to Market Surveillance Authority:** [ ] Yes [ ] No
- **Date of Notification:** [TO BE COMPLETED]
- **Authority Notified:** [TO BE COMPLETED]

---

## 8. Attachments

[List any supporting documentation]

---

## 9. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Incident Manager | | | |
| Legal | | | |
| Compliance Officer | | | |

---

*This template complies with Article 62 of the EU AI Act (Regulation 2024/1689).*
`

  return {
    title: `Incident Report Template - ${system.name}`,
    content,
    type: 'INCIDENT_REPORT',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name
    }
  }
}

// ============================================
// Post-Market Monitoring Plan (Article 72)
// ============================================

function generatePostMarketPlan(system: AISystem, generatedAt: Date): GeneratedDocument {
  const wizardData = system.wizardData as Record<string, unknown> | null
  const deploymentScale = wizardData?.deploymentScale as string || 'limited'
  const isHighRisk = system.riskLevel === 'HIGH'

  // Determine monitoring frequency based on risk and scale
  const monitoringFrequency = isHighRisk
    ? (deploymentScale === 'mass' ? 'Real-time with daily review' : 'Daily with weekly review')
    : (deploymentScale === 'mass' ? 'Weekly' : 'Monthly')

  const content = `# Post-Market Monitoring Plan

## AI System: ${system.name}

**Version:** ${system.version || '1.0'}
**Generated:** ${generatedAt.toISOString()}
**Document Reference:** PMM-${system.id.slice(0, 8).toUpperCase()}
**Risk Classification:** ${system.riskLevel}
**Plan Period:** 12 months from deployment (review annually)

---

## 1. Introduction

### 1.1 Purpose
This document establishes the post-market monitoring system for "${system.name}" as required by Article 72 of the EU AI Act. Post-market monitoring ensures ongoing compliance and enables detection of issues that may emerge during real-world operation.

### 1.2 Scope
This plan covers:
- Performance monitoring and quality assurance
- Safety and fundamental rights impact tracking
- User feedback collection and analysis
- Incident detection, reporting, and response
- Compliance verification and updates

### 1.3 System Context
| Attribute | Value |
|-----------|-------|
| Risk Level | ${system.riskLevel} |
| Deployment Scale | ${formatDeploymentScale(deploymentScale)} |
| Annex III Category | ${formatAnnexIIICategory(system.annexIIICategory)} |
| Monitoring Intensity | ${isHighRisk ? 'Enhanced (High-Risk System)' : 'Standard'} |

---

## 2. Monitoring Framework

### 2.1 Objectives
${isHighRisk ? `
**High-Risk System Monitoring Requirements:**
1. Continuous compliance with EU AI Act requirements (Articles 8-15)
2. Active detection of performance degradation, drift, or bias
3. Systematic collection and analysis of operational data
4. Proactive identification of emerging risks or unintended behaviors
5. Regular validation against accuracy, robustness, and cybersecurity requirements
` : `
**Standard Monitoring Requirements:**
1. Periodic compliance verification
2. Performance tracking against baselines
3. User feedback monitoring
4. Incident tracking and analysis
`}

### 2.2 Monitoring Schedule

| Activity | Frequency | Responsible | Deliverable |
|----------|-----------|-------------|-------------|
| Automated metrics collection | ${isHighRisk ? 'Continuous' : 'Daily'} | Monitoring System | Dashboard update |
| Performance review | ${monitoringFrequency} | Technical Team | Performance report |
| Bias/Fairness audit | ${isHighRisk ? 'Monthly' : 'Quarterly'} | Compliance Team | Audit report |
| User feedback analysis | Weekly | Product Team | Feedback summary |
| Incident review | Per incident + Monthly summary | Incident Team | Incident report |
| Compliance review | Quarterly | Compliance Officer | Compliance report |
| Comprehensive audit | Annual | External/Internal | Audit report |

---

## 3. Data Collection

### 3.1 Automated Performance Metrics

| Metric Category | Specific Metrics | Target | Alert Threshold | Collection |
|-----------------|------------------|--------|-----------------|------------|
| **Accuracy** | | | | |
| - Precision | Overall precision | ≥ 95% | < 90% | Per prediction |
| - Recall | Overall recall | ≥ 95% | < 90% | Per prediction |
| - F1 Score | Harmonic mean | ≥ 0.95 | < 0.90 | Hourly aggregate |
| **Fairness** | | | | |
| - Demographic Parity | Group difference | < 0.1 | ≥ 0.15 | Daily aggregate |
| - Equal Opportunity | TPR difference | < 0.1 | ≥ 0.15 | Daily aggregate |
| **Robustness** | | | | |
| - Error rate | System errors | < 1% | ≥ 5% | Continuous |
| - Latency P95 | Response time | < 2s | ≥ 5s | Per request |
| **Drift** | | | | |
| - Data drift | Distribution shift | < 0.1 PSI | ≥ 0.2 PSI | Daily |
| - Concept drift | Performance decay | < 5% | ≥ 10% | Weekly |

### 3.2 User Feedback Collection

**Feedback Channels:**
1. **In-Application Feedback**
   - Rating system (1-5 stars) after interactions
   - "Was this helpful?" quick feedback
   - Detailed feedback form for issues

2. **Support Channels**
   - Dedicated AI system support queue
   - Issue categorization and tagging
   - Escalation to monitoring team

3. **Surveys**
   - Quarterly user satisfaction survey
   - Annual comprehensive assessment
   - Post-incident follow-up surveys

**Feedback Processing:**
- Automated sentiment analysis on feedback
- Weekly categorization and trend analysis
- Escalation criteria for negative patterns

### 3.3 Incident Data Collection

**Automatic Logging:**
- All errors and exceptions
- Anomalous outputs (outliers, unexpected patterns)
- Performance threshold breaches
- Security events

**Manual Reporting:**
- User-reported issues
- Internal quality observations
- Third-party notifications

---

## 4. Analysis Procedures

### 4.1 Trend Analysis

**Statistical Methods:**
- Time-series analysis for performance metrics
- Moving averages (7-day, 30-day windows)
- Seasonal decomposition where applicable
- Change point detection algorithms

**Visualization:**
- Real-time dashboards with trend indicators
- Weekly trend reports with historical comparison
- Anomaly highlighting and alerting

### 4.2 Anomaly Detection

**Detection Methods:**
| Method | Application | Alert Level |
|--------|-------------|-------------|
| Statistical (Z-score) | Metric deviations | Warning at 2σ, Critical at 3σ |
| ML-based | Pattern anomalies | Confidence-based thresholds |
| Rule-based | Known failure patterns | Immediate alert |

**Response Protocol:**
1. Automated alert generation
2. Initial triage within 1 hour
3. Root cause analysis within 24 hours
4. Resolution tracking to closure

### 4.3 Bias Monitoring

**Continuous Monitoring:**
- Disaggregated performance metrics by protected characteristics
- Automated fairness metric calculations
- Comparison against baseline and thresholds

**Periodic Audits:**
- ${isHighRisk ? 'Monthly' : 'Quarterly'} comprehensive bias assessment
- External audit annually for high-risk systems
- Documentation of findings and remediation

---

## 5. Response Procedures

### 5.1 Alert Thresholds and Actions

| Severity | Threshold | Response Time | Actions |
|----------|-----------|---------------|---------|
| **Critical** | Safety impact, >10% performance drop, bias detected | Immediate | Stop system, investigate, notify authorities if required |
| **High** | 5-10% performance drop, repeated errors | 1 hour | Investigation, potential rollback |
| **Medium** | 2-5% deviation, negative feedback spike | 24 hours | Analysis, scheduled fix |
| **Low** | Minor deviations, single incidents | 1 week | Log, monitor, batch fix |

### 5.2 Escalation Path

\`\`\`
Level 1: Monitoring Team
    ↓ (unresolved in 4 hours or High/Critical severity)
Level 2: Technical Lead + Compliance Officer
    ↓ (unresolved in 24 hours or Critical severity)
Level 3: System Owner + Legal
    ↓ (safety/rights impact confirmed)
Level 4: Executive + Market Surveillance Authority notification
\`\`\`

### 5.3 Corrective Actions Catalog

| Issue Type | Standard Corrective Actions |
|------------|----------------------------|
| Performance degradation | Retraining, data refresh, model rollback |
| Bias detected | Bias mitigation, data rebalancing, threshold adjustment |
| Drift | Model update, feature recalibration |
| Security issue | Patch deployment, access review, incident response |
| User complaints | Process improvement, UI updates, documentation |

---

## 6. Reporting

### 6.1 Internal Reports

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| Daily Dashboard | Daily | Technical Team | Real-time metrics, alerts |
| Weekly Summary | Weekly | Management | KPIs, incidents, actions |
| Monthly Review | Monthly | Steering Committee | Trends, compliance status |
| Quarterly Report | Quarterly | Board/Executive | Strategic overview, risks |

### 6.2 Regulatory Reporting

**Mandatory Notifications:**
- Serious incidents: Within 15 days to Market Surveillance Authority (Article 62)
- Significant modifications: Prior to deployment
- Annual compliance summary: To competent authority

**Documentation Requirements:**
- Maintain logs for minimum 10 years (Article 12)
- Make available to authorities on request
- Automated log retention and integrity verification

---

## 7. Responsibilities

| Role | Responsibilities | Contact |
|------|------------------|---------|
| **System Owner** | Overall accountability, strategic decisions, authority liaison | TBD |
| **Technical Lead** | System performance, technical remediation | TBD |
| **Monitoring Team** | Day-to-day monitoring, alert triage, reporting | TBD |
| **Compliance Officer** | Regulatory compliance, documentation, audits | TBD |
| **Data Protection Officer** | Privacy monitoring, GDPR compliance | TBD |
| **Incident Manager** | Incident coordination, authority notifications | TBD |

---

## 8. Review and Updates

This plan will be reviewed:
- Annually at minimum
- After any serious incident
- When significant system changes occur

---

*This document was auto-generated by AgentGov EU AI Act Compliance Module.*
`

  return {
    title: `Post-Market Monitoring Plan - ${system.name}`,
    content,
    type: 'POST_MARKET_MONITORING',
    generatedFrom: {
      systemId: system.id,
      systemName: system.name
    }
  }
}
