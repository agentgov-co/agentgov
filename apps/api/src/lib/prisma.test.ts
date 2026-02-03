import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Verifies the Prisma $extends configuration protects all compliance models.
 *
 * Uses regex to extract model blocks from the $extends call, making tests
 * resilient to whitespace/formatting changes. The actual soft-delete behavior
 * is tested in compliance.test.ts (DELETE → record keeps deletedAt).
 */

const currentDir = dirname(fileURLToPath(import.meta.url))
const prismaSource = readFileSync(resolve(currentDir, 'prisma.ts'), 'utf-8')

// Extract the $extends block
const extendsMatch = prismaSource.match(/\$extends\(\{[\s\S]*?\n {2}\}\)/)
const extendsBlock = extendsMatch?.[0] ?? ''

/**
 * Extract a model's block from $extends by finding its key and matching braces.
 */
function extractModelBlock(model: string): string {
  const start = extendsBlock.indexOf(`${model}:`)
  if (start === -1) return ''
  let depth = 0
  let blockStart = -1
  for (let i = start; i < extendsBlock.length; i++) {
    if (extendsBlock[i] === '{') {
      if (blockStart === -1) blockStart = i
      depth++
    } else if (extendsBlock[i] === '}') {
      depth--
      if (depth === 0) return extendsBlock.slice(start, i + 1)
    }
  }
  return ''
}

describe('Prisma $extends Compliance Protection', () => {
  it('should have a $extends block', () => {
    expect(extendsBlock.length).toBeGreaterThan(0)
  })

  describe('Soft-delete models (aISystem, incidentReport, complianceDocument)', () => {
    const softDeleteModels = ['aISystem', 'incidentReport', 'complianceDocument']

    for (const model of softDeleteModels) {
      describe(model, () => {
        const block = extractModelBlock(model)

        it('should be present in $extends', () => {
          expect(block).not.toBe('')
        })

        it('should override delete to set deletedAt', () => {
          expect(block).toMatch(/async delete\b/)
          expect(block).toMatch(/deletedAt:\s*new Date\(\)/)
        })

        it('should override deleteMany to set deletedAt', () => {
          expect(block).toMatch(/async deleteMany\b/)
        })

        it('should filter soft-deleted records in findMany', () => {
          expect(block).toMatch(/async findMany\b/)
          expect(block).toMatch(/deletedAt:\s*null/)
        })

        it('should filter soft-deleted records in findFirst', () => {
          expect(block).toMatch(/async findFirst\b/)
        })
      })
    }
  })

  describe('Hard-delete blocked models (complianceObligation, humanOversightConfig)', () => {
    const blockedModels = ['complianceObligation', 'humanOversightConfig']

    for (const model of blockedModels) {
      describe(model, () => {
        const block = extractModelBlock(model)

        it('should be present in $extends', () => {
          expect(block).not.toBe('')
        })

        it('should throw on delete', () => {
          expect(block).toMatch(/async delete\b/)
          expect(block).toContain('Hard delete not allowed on compliance data')
        })

        it('should throw on deleteMany', () => {
          expect(block).toMatch(/async deleteMany\b/)
        })

        it('should NOT have soft-delete (no deletedAt update)', () => {
          expect(block).not.toMatch(/deletedAt:\s*new Date\(\)/)
        })
      })
    }
  })
})
