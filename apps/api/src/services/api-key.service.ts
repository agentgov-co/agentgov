/**
 * API Key Service
 *
 * Handles secure generation, hashing, and management of API keys.
 * Following security best practices for API key management.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'

// Constants
const API_KEY_PREFIX_LIVE = 'ag_live_'
const API_KEY_PREFIX_TEST = 'ag_test_'
const API_KEY_RANDOM_BYTES = 24 // 48 hex chars = 192 bits of entropy
const DEFAULT_PERMISSIONS = ['traces:write', 'traces:read'] as const

export type ApiKeyType = 'live' | 'test'
export type ApiKeyPermission = (typeof DEFAULT_PERMISSIONS)[number]

export interface GeneratedApiKey {
  /** The raw API key (only returned once, never stored) */
  key: string
  /** SHA-256 hash of the key for storage */
  hash: string
  /** Key prefix (ag_live_ or ag_test_) */
  prefix: string
}

/** Prisma transaction client type */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface CreateApiKeyOptions {
  name: string
  userId: string
  organizationId: string
  projectId?: string
  type?: ApiKeyType
  permissions?: ApiKeyPermission[]
  expiresAt?: Date
  allowedIps?: string[]
  /** Prisma transaction client (for atomic operations) */
  tx?: TransactionClient
}

export interface ApiKeyServiceResult {
  id: string
  name: string
  keyPrefix: string
  projectId: string | null
  permissions: string[]
  createdAt: Date
}

/**
 * Generate a cryptographically secure API key
 *
 * Key format: {prefix}{random_hex}
 * - prefix: ag_live_ or ag_test_
 * - random: 48 hex characters (192 bits of entropy)
 *
 * Security considerations:
 * - Uses crypto.randomBytes() for CSPRNG
 * - 192 bits of entropy exceeds OWASP recommendations
 * - Prefix allows easy identification without exposing key
 */
export function generateApiKey(type: ApiKeyType = 'live'): GeneratedApiKey {
  const prefix = type === 'live' ? API_KEY_PREFIX_LIVE : API_KEY_PREFIX_TEST
  const randomPart = randomBytes(API_KEY_RANDOM_BYTES).toString('hex')
  const key = `${prefix}${randomPart}`
  const hash = hashApiKey(key)

  return { key, hash, prefix }
}

/**
 * Hash an API key using SHA-256
 *
 * Security considerations:
 * - SHA-256 is one-way (key cannot be recovered from hash)
 * - Deterministic (same key always produces same hash for lookup)
 * - Fast enough for real-time validation
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Validate API key format
 * Returns true if the key matches expected format
 */
export function isValidApiKeyFormat(key: string): boolean {
  const livePattern = /^ag_live_[a-f0-9]{48}$/
  const testPattern = /^ag_test_[a-f0-9]{48}$/
  return livePattern.test(key) || testPattern.test(key)
}

/**
 * Extract prefix from API key
 */
export function getApiKeyPrefix(key: string): string {
  if (key.startsWith(API_KEY_PREFIX_LIVE)) return API_KEY_PREFIX_LIVE
  if (key.startsWith(API_KEY_PREFIX_TEST)) return API_KEY_PREFIX_TEST
  return ''
}

/**
 * Constant-time comparison of two strings
 * Prevents timing attacks when comparing API keys/hashes
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * API Key Service
 *
 * Provides methods for creating and managing API keys with proper
 * security practices and audit logging.
 */
export const apiKeyService = {
  /**
   * Create a new API key
   *
   * @param options - Key creation options
   * @returns The created key record and the raw key (returned only once)
   */
  async create(options: CreateApiKeyOptions): Promise<{
    apiKey: ApiKeyServiceResult
    rawKey: string
  }> {
    const {
      name,
      userId,
      organizationId,
      projectId,
      type = 'live',
      permissions = [...DEFAULT_PERMISSIONS],
      expiresAt,
      allowedIps = [],
      tx,
    } = options

    const { key, hash, prefix } = generateApiKey(type)
    const client = tx ?? prisma

    const apiKey = await client.apiKey.create({
      data: {
        name,
        keyHash: hash,
        keyPrefix: prefix,
        userId,
        organizationId,
        projectId: projectId ?? null,
        permissions,
        expiresAt: expiresAt ?? null,
        allowedIps,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        createdAt: true,
      },
    })

    return {
      apiKey,
      rawKey: key,
    }
  },

  /**
   * Create a default API key for a project
   * Used during project creation in onboarding flow
   */
  async createForProject(
    projectId: string,
    projectName: string,
    userId: string,
    organizationId: string,
    keyHash: string,
    tx?: TransactionClient
  ): Promise<ApiKeyServiceResult> {
    const client = tx ?? prisma

    return client.apiKey.create({
      data: {
        name: `${projectName} - Default Key`,
        keyHash,
        keyPrefix: API_KEY_PREFIX_LIVE,
        userId,
        organizationId,
        projectId,
        permissions: [...DEFAULT_PERMISSIONS],
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        createdAt: true,
      },
    })
  },

  /**
   * Find API key by hash
   */
  async findByHash(hash: string) {
    return prisma.apiKey.findUnique({
      where: { keyHash: hash },
      include: {
        project: {
          select: { id: true, name: true, organizationId: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    })
  },

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  },

  /**
   * Check if API key is expired
   */
  isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false
    return new Date() > expiresAt
  },
}

export default apiKeyService
