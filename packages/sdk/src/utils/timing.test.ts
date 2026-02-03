import { describe, it, expect } from 'vitest'
import { estimateCost, calculateDuration } from './timing.js'

describe('timing utils', () => {
  describe('calculateDuration', () => {
    it('should calculate duration from start time', () => {
      const startTime = Date.now() - 1000 // 1 second ago
      const duration = calculateDuration(startTime)

      // Allow some tolerance for test execution time
      expect(duration).toBeGreaterThanOrEqual(1000)
      expect(duration).toBeLessThan(1100)
    })
  })

  describe('estimateCost', () => {
    it('should estimate cost for gpt-4o', () => {
      const cost = estimateCost('gpt-4o', 1000, 500)
      // gpt-4o: $2.50/1M input, $10.00/1M output
      // Expected: (1000/1M * 2.50) + (500/1M * 10.00) = 0.0025 + 0.005 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 6)
    })

    it('should estimate cost for gpt-4o-mini', () => {
      const cost = estimateCost('gpt-4o-mini', 1000, 500)
      // gpt-4o-mini: $0.15/1M input, $0.60/1M output
      // Expected: (1000/1M * 0.15) + (500/1M * 0.60) = 0.00015 + 0.0003 = 0.00045
      expect(cost).toBeCloseTo(0.00045, 6)
    })

    it('should estimate cost for gpt-4', () => {
      const cost = estimateCost('gpt-4', 1000, 500)
      // gpt-4: $30.00/1M input, $60.00/1M output
      // Expected: (1000/1M * 30) + (500/1M * 60) = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06, 6)
    })

    it('should estimate cost for claude-3-sonnet', () => {
      const cost = estimateCost('claude-3-sonnet', 1000, 500)
      // claude-3-sonnet: $3.00/1M input, $15.00/1M output
      // Expected: (1000/1M * 3) + (500/1M * 15) = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 6)
    })

    it('should estimate cost for gpt-4.1', () => {
      const cost = estimateCost('gpt-4.1', 1000, 500)
      // gpt-4.1: $2.00/1M input, $8.00/1M output
      // Expected: (1000/1M * 2) + (500/1M * 8) = 0.002 + 0.004 = 0.006
      expect(cost).toBeCloseTo(0.006, 6)
    })

    it('should estimate cost for o4-mini', () => {
      const cost = estimateCost('o4-mini', 1000, 500)
      // o4-mini: $1.10/1M input, $4.40/1M output
      // Expected: (1000/1M * 1.10) + (500/1M * 4.40) = 0.0011 + 0.0022 = 0.0033
      expect(cost).toBeCloseTo(0.0033, 6)
    })

    it('should estimate cost for o3', () => {
      const cost = estimateCost('o3', 1000, 500)
      // o3: $10.00/1M input, $40.00/1M output
      // Expected: (1000/1M * 10) + (500/1M * 40) = 0.01 + 0.02 = 0.03
      expect(cost).toBeCloseTo(0.03, 6)
    })

    it('should estimate cost for gpt-5.2 (flagship)', () => {
      const cost = estimateCost('gpt-5.2', 1000, 500)
      // gpt-5.2: $1.75/1M input, $14.00/1M output
      // Expected: (1000/1M * 1.75) + (500/1M * 14) = 0.00175 + 0.007 = 0.00875
      expect(cost).toBeCloseTo(0.00875, 6)
    })

    it('should estimate cost for embedding models (no output tokens)', () => {
      const cost = estimateCost('text-embedding-3-small', 1000, 0)
      // text-embedding-3-small: $0.02/1M input
      // Expected: 1000/1M * 0.02 = 0.00002
      expect(cost).toBeCloseTo(0.00002, 6)
    })

    it('should use default pricing for unknown models', () => {
      const cost = estimateCost('unknown-model-xyz', 1000, 500)
      // default: $1.00/1M input, $2.00/1M output
      // Expected: (1000/1M * 1) + (500/1M * 2) = 0.001 + 0.001 = 0.002
      expect(cost).toBeCloseTo(0.002, 6)
    })

    it('should handle partial model name matches', () => {
      // Should match gpt-4o even with version suffix
      const cost = estimateCost('gpt-4o-2024-05-01', 1000, 500)
      expect(cost).toBeCloseTo(0.0075, 6)
    })

    it('should handle zero tokens', () => {
      const cost = estimateCost('gpt-4o', 0, 0)
      expect(cost).toBe(0)
    })

    it('should handle large token counts', () => {
      const cost = estimateCost('gpt-4o', 1000000, 500000)
      // Expected: (1 * 2.50) + (0.5 * 10.00) = 2.50 + 5.00 = 7.50
      expect(cost).toBeCloseTo(7.5, 2)
    })
  })
})
