import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { GLOBAL_BODY_LIMIT, SDK_BODY_LIMIT } from '../lib/constants.js'

/**
 * AC-1.7: Payload size limits
 *
 * Uses the same constants as production code (GLOBAL_BODY_LIMIT, SDK_BODY_LIMIT).
 * If limits change in constants.ts, these tests break accordingly.
 */

describe('AC-1.7: Payload size limits', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({
      logger: false,
      bodyLimit: GLOBAL_BODY_LIMIT,
    })

    // Standard route with global limit
    app.post('/v1/standard', async (request) => {
      return { ok: true, size: JSON.stringify(request.body).length }
    })

    // SDK route with elevated limit (same as traces.ts / spans.ts)
    app.post('/v1/traces', { bodyLimit: SDK_BODY_LIMIT }, async (request) => {
      return { ok: true, size: JSON.stringify(request.body).length }
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  function generatePayload(sizeBytes: number): string {
    const overhead = '{"data":""}'.length
    const filler = 'x'.repeat(Math.max(0, sizeBytes - overhead))
    return JSON.stringify({ data: filler })
  }

  describe('Global limit (standard routes)', () => {
    it('should accept 500KB payload → 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/standard',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(500 * 1024),
      })
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).ok).toBe(true)
    })

    it('should reject 2MB payload → 413', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/standard',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(2 * 1024 * 1024),
      })
      expect(response.statusCode).toBe(413)
    })

    it('should reject payload at boundary (GLOBAL_BODY_LIMIT + 1) → 413', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/standard',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(GLOBAL_BODY_LIMIT + 1),
      })
      expect(response.statusCode).toBe(413)
    })

    it('should return proper 413 error body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/standard',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(2 * 1024 * 1024),
      })
      expect(response.statusCode).toBe(413)
      const body = JSON.parse(response.body)
      expect(body.message).toBeDefined()
      expect(body.statusCode).toBe(413)
    })

    it('should accept empty body → 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/standard',
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('SDK limit (trace/span routes)', () => {
    it('should accept 4MB payload → 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(4 * 1024 * 1024),
      })
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).ok).toBe(true)
    })

    it('should reject 6MB payload → 413', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(6 * 1024 * 1024),
      })
      expect(response.statusCode).toBe(413)
    })

    it('should accept 1.5MB payload (above global, below SDK) → 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(1.5 * 1024 * 1024),
      })
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).ok).toBe(true)
    })

    it('should reject payload at SDK boundary (SDK_BODY_LIMIT + 1) → 413', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(SDK_BODY_LIMIT + 1),
      })
      expect(response.statusCode).toBe(413)
    })

    it('should accept 500KB payload on SDK route → 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { 'content-type': 'application/json' },
        payload: generatePayload(500 * 1024),
      })
      expect(response.statusCode).toBe(200)
    })
  })
})
