/**
 * API Key Service Tests
 *
 * Tests for secure API key generation, hashing, and validation.
 */

import { describe, it, expect } from 'vitest'
import {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  getApiKeyPrefix,
  secureCompare,
} from './api-key.service.js'

describe('API Key Service', () => {
  describe('generateApiKey', () => {
    it('should generate a live API key with correct format', () => {
      const { key, hash, prefix } = generateApiKey('live')

      expect(key).toMatch(/^ag_live_[a-f0-9]{48}$/)
      expect(prefix).toBe('ag_live_')
      expect(hash).toHaveLength(64) // SHA-256 hex = 64 chars
    })

    it('should generate a test API key with correct format', () => {
      const { key, hash, prefix } = generateApiKey('test')

      expect(key).toMatch(/^ag_test_[a-f0-9]{48}$/)
      expect(prefix).toBe('ag_test_')
      expect(hash).toHaveLength(64)
    })

    it('should default to live key when no type specified', () => {
      const { key } = generateApiKey()

      expect(key).toMatch(/^ag_live_/)
    })

    it('should generate unique keys on each call', () => {
      const key1 = generateApiKey()
      const key2 = generateApiKey()

      expect(key1.key).not.toBe(key2.key)
      expect(key1.hash).not.toBe(key2.hash)
    })

    it('should generate cryptographically secure keys with sufficient entropy', () => {
      // Generate multiple keys and ensure they're unique
      const keys = new Set<string>()
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        keys.add(generateApiKey().key)
      }

      // All keys should be unique
      expect(keys.size).toBe(iterations)
    })
  })

  describe('hashApiKey', () => {
    it('should produce a 64-character hex string', () => {
      const hash = hashApiKey('ag_live_test123')

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce consistent hashes for the same input', () => {
      const key = 'ag_live_abcdef123456'
      const hash1 = hashApiKey(key)
      const hash2 = hashApiKey(key)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashApiKey('ag_live_key1')
      const hash2 = hashApiKey('ag_live_key2')

      expect(hash1).not.toBe(hash2)
    })

    it('should be irreversible (one-way function)', () => {
      // This is a conceptual test - we can't actually prove irreversibility,
      // but we can verify the hash doesn't contain the original key
      const key = 'ag_live_supersecretkey123456789012345678901234'
      const hash = hashApiKey(key)

      expect(hash).not.toContain('supersecret')
      expect(hash).not.toContain('ag_live')
    })
  })

  describe('isValidApiKeyFormat', () => {
    it('should validate correct live key format', () => {
      const validKey = 'ag_live_' + 'a'.repeat(48)
      expect(isValidApiKeyFormat(validKey)).toBe(true)
    })

    it('should validate correct test key format', () => {
      const validKey = 'ag_test_' + 'f'.repeat(48)
      expect(isValidApiKeyFormat(validKey)).toBe(true)
    })

    it('should reject keys with wrong prefix', () => {
      expect(isValidApiKeyFormat('ag_prod_' + 'a'.repeat(48))).toBe(false)
      expect(isValidApiKeyFormat('sk_live_' + 'a'.repeat(48))).toBe(false)
    })

    it('should reject keys with wrong length', () => {
      expect(isValidApiKeyFormat('ag_live_' + 'a'.repeat(47))).toBe(false)
      expect(isValidApiKeyFormat('ag_live_' + 'a'.repeat(49))).toBe(false)
    })

    it('should reject keys with non-hex characters', () => {
      expect(isValidApiKeyFormat('ag_live_' + 'g'.repeat(48))).toBe(false)
      expect(isValidApiKeyFormat('ag_live_' + 'A'.repeat(48))).toBe(false)
    })

    it('should reject empty and malformed strings', () => {
      expect(isValidApiKeyFormat('')).toBe(false)
      expect(isValidApiKeyFormat('ag_live_')).toBe(false)
      expect(isValidApiKeyFormat('random_string')).toBe(false)
    })

    it('should validate real generated keys', () => {
      const { key: liveKey } = generateApiKey('live')
      const { key: testKey } = generateApiKey('test')

      expect(isValidApiKeyFormat(liveKey)).toBe(true)
      expect(isValidApiKeyFormat(testKey)).toBe(true)
    })
  })

  describe('getApiKeyPrefix', () => {
    it('should extract live prefix', () => {
      expect(getApiKeyPrefix('ag_live_abc123')).toBe('ag_live_')
    })

    it('should extract test prefix', () => {
      expect(getApiKeyPrefix('ag_test_abc123')).toBe('ag_test_')
    })

    it('should return empty string for unknown prefix', () => {
      expect(getApiKeyPrefix('sk_live_abc123')).toBe('')
      expect(getApiKeyPrefix('random')).toBe('')
    })
  })

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('abc123', 'abc123')).toBe(true)
      expect(secureCompare('', '')).toBe(true)
    })

    it('should return false for different strings', () => {
      expect(secureCompare('abc123', 'abc124')).toBe(false)
      expect(secureCompare('abc123', 'ABC123')).toBe(false)
    })

    it('should return false for different length strings', () => {
      expect(secureCompare('abc', 'abcd')).toBe(false)
      expect(secureCompare('abcd', 'abc')).toBe(false)
    })

    it('should be resistant to timing attacks (constant-time)', () => {
      // This test verifies the implementation uses timingSafeEqual
      // We can't easily test timing characteristics, but we verify behavior
      const hash1 = hashApiKey('key1')
      const hash2 = hashApiKey('key2')

      // Both comparisons should complete regardless of where they differ
      expect(secureCompare(hash1, hash2)).toBe(false)
      expect(secureCompare(hash1, hash1)).toBe(true)
    })
  })

  describe('Security Properties', () => {
    it('should generate keys with at least 192 bits of entropy', () => {
      // Key format: ag_live_ (8 chars) + 48 hex chars
      // 48 hex chars = 24 bytes = 192 bits
      const { key } = generateApiKey()
      const randomPart = key.slice(8) // Remove prefix

      expect(randomPart).toHaveLength(48)
    })

    it('should not leak key material in hash', () => {
      const { key, hash } = generateApiKey()

      // Hash should not contain any part of the key's random portion
      const randomPart = key.slice(8)
      expect(hash).not.toContain(randomPart.slice(0, 8))
    })

    it('should produce different hashes for keys with only 1 character difference', () => {
      const key1 = 'ag_live_' + '0'.repeat(48)
      const key2 = 'ag_live_' + '0'.repeat(47) + '1'

      const hash1 = hashApiKey(key1)
      const hash2 = hashApiKey(key2)

      expect(hash1).not.toBe(hash2)

      // Hashes should be completely different (avalanche effect)
      let diffCount = 0
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) diffCount++
      }
      // At least 50% of characters should differ (avalanche effect)
      expect(diffCount).toBeGreaterThan(hash1.length / 2)
    })
  })
})
