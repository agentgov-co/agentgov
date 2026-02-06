import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import websocket from '@fastify/websocket'
import { wsManager } from '../lib/websocket-manager.js'
import { validateWebSocketApiKey, validateProjectAccess, type WSAuthResult } from '../middleware/auth.js'
import { getRedisClient } from '../lib/redis.js'
import { randomUUID } from 'crypto'

// Ticket TTL in seconds
const WS_TICKET_TTL = 30

export interface WsTicketData {
  projectId: string
  userId: string
  orgId: string
  ip: string
}

/** Extract API key from request headers (x-api-key or Authorization: Bearer) */
export function extractApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const xApiKey = headers['x-api-key']
  if (typeof xApiKey === 'string' && xApiKey) return xApiKey

  const auth = headers['authorization']
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7)

  return undefined
}

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  // Register WebSocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576 // 1MB
    }
  })

  // POST /v1/ws/ticket - Generate one-time WebSocket auth ticket
  fastify.post('/v1/ws/ticket', async (request, reply) => {
    // Require session auth
    if (!request.user || !request.organization) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Session authentication required',
      })
    }

    const { projectId } = request.body as { projectId?: string }
    if (!projectId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'projectId is required',
      })
    }

    // Verify project access
    const hasAccess = await validateProjectAccess(projectId, request.organization.id)
    if (!hasAccess) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Project not found or access denied',
      })
    }

    const redis = getRedisClient()
    if (!redis) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'WebSocket tickets require Redis',
      })
    }

    const ticket = randomUUID()
    const ticketData: WsTicketData = {
      projectId,
      userId: request.user.id,
      orgId: request.organization.id,
      ip: request.ip,
    }

    await redis.set(
      `ws:ticket:${ticket}`,
      JSON.stringify(ticketData),
      'EX',
      WS_TICKET_TTL
    )

    return { ticket }
  })

  // WebSocket route with authentication
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    // Extract API key from headers only (no query param)
    const query = request.query as { projectId?: string }
    const apiKey = extractApiKey(request.headers as Record<string, string | string[] | undefined>)

    let authResult: WSAuthResult

    // Try API key auth first (for SDK)
    if (apiKey && apiKey.startsWith('ag_')) {
      authResult = await validateWebSocketApiKey(apiKey)
    }
    // Try session auth (for dashboard) - user/organization populated by auth plugin
    else if (request.user && request.organization) {
      const projectId = query.projectId
      if (!projectId) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'projectId required for session auth'
        }))
        socket.close(4000, 'Bad Request')
        return
      }

      // Verify project belongs to user's organization
      const hasAccess = await validateProjectAccess(projectId, request.organization.id)
      if (!hasAccess) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Project not found or access denied'
        }))
        socket.close(4003, 'Forbidden')
        return
      }

      authResult = {
        authenticated: true,
        projectId,
        organizationId: request.organization.id,
        userId: request.user.id,
        authType: 'session',
      }
    }
    // No immediate auth — wait for ticket-based auth message
    else {
      // Set up ticket auth: expect first message to be { type: "auth", ticket: "..." }
      const authTimeout = setTimeout(() => {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Authentication timeout'
        }))
        socket.close(4401, 'Unauthorized')
      }, 10_000) // 10 second timeout for ticket auth

      socket.once('message', async (message) => {
        clearTimeout(authTimeout)

        try {
          const data = JSON.parse(message.toString())

          if (data.type !== 'auth' || !data.ticket) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Expected auth message with ticket'
            }))
            socket.close(4401, 'Unauthorized')
            return
          }

          const redis = getRedisClient()
          if (!redis) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Ticket validation unavailable'
            }))
            socket.close(4401, 'Unauthorized')
            return
          }

          // Atomically get and delete ticket (one-time use via Lua script)
          const ticketKey = `ws:ticket:${data.ticket}`
          const ticketJson = await redis.eval(
            "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
            1,
            ticketKey
          ) as string | null

          if (!ticketJson) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Invalid or expired ticket'
            }))
            socket.close(4401, 'Unauthorized')
            return
          }

          const ticketData = JSON.parse(ticketJson) as WsTicketData

          // IP check: disabled by default because without Fastify trustProxy,
          // request.ip returns the proxy/CDN IP — not the real client.
          // The ticket is already one-time-use (atomic GETDEL) with 30s TTL
          // and requires a valid session to create, so IP binding is optional.
          if (process.env.WS_TICKET_CHECK_IP === 'true' && ticketData.ip !== request.ip) {
            fastify.log.warn(
              { expected: ticketData.ip, actual: request.ip },
              '[WS] Ticket IP mismatch — enable Fastify trustProxy if behind a reverse proxy'
            )
            socket.send(JSON.stringify({
              type: 'error',
              message: 'IP mismatch'
            }))
            socket.close(4401, 'Unauthorized')
            return
          }

          // Auth successful — register client
          const clientId = wsManager.addClient(socket, ticketData.projectId)

          socket.send(JSON.stringify({
            type: 'authenticated',
            projectId: ticketData.projectId,
          }))

          socket.on('message', (msg) => {
            wsManager.handleMessage(clientId, msg.toString())
          })

          socket.on('close', () => {
            wsManager.removeClient(clientId)
          })

          socket.on('error', (error) => {
            fastify.log.error({ err: error, clientId }, '[WS] Socket error')
            wsManager.removeClient(clientId)
          })
        } catch {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid auth message'
          }))
          socket.close(4401, 'Unauthorized')
        }
      })

      return
    }

    if (!authResult.authenticated) {
      fastify.log.warn(`[WS] Auth failed: ${authResult.error}`)
      socket.send(JSON.stringify({
        type: 'error',
        message: authResult.error || 'Authentication failed'
      }))
      socket.close(4001, 'Unauthorized')
      return
    }

    // Use authenticated project or allow query param if user has org access
    const projectId = query.projectId || authResult.projectId || 'default'

    // If projectId specified with API key auth, verify access
    if (authResult.authType === 'api_key' && query.projectId && authResult.projectId && query.projectId !== authResult.projectId) {
      // API key is scoped to different project
      socket.send(JSON.stringify({
        type: 'error',
        message: 'API key not authorized for this project'
      }))
      socket.close(4003, 'Forbidden')
      return
    }

    // Add client to manager
    const clientId = wsManager.addClient(socket, projectId)

    // Handle incoming messages
    socket.on('message', (message) => {
      wsManager.handleMessage(clientId, message.toString())
    })

    // Handle close
    socket.on('close', () => {
      wsManager.removeClient(clientId)
    })

    // Handle errors
    socket.on('error', (error) => {
      fastify.log.error({ err: error, clientId }, '[WS] Socket error')
      wsManager.removeClient(clientId)
    })
  })

  // Health check endpoint for WebSocket
  fastify.get('/ws/health', async () => ({
    status: 'ok',
    connections: wsManager.getClientCount()
  }))

  // Decorate fastify with wsManager for use in routes
  fastify.decorate('wsManager', wsManager)
}

export default fp(websocketPlugin, {
  name: 'websocket-plugin'
})

// TypeScript declaration
declare module 'fastify' {
  interface FastifyInstance {
    wsManager: typeof wsManager
  }
}
