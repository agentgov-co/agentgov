import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export async function setupSwagger(fastify: FastifyInstance, nodeEnv: string): Promise<void> {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'AgentGov API',
        description: 'AI Agent Governance Platform API - Monitor, trace, and govern AI agents with security and compliance in mind.',
        version: '1.0.1',
        contact: {
          name: 'AgentGov Team',
          url: 'https://agentgov.io'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3001',
          description: nodeEnv === 'production' ? 'Production server' : 'Development server'
        }
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Traces', description: 'Trace management for AI agent executions' },
        { name: 'Spans', description: 'Span management for individual operations' },
        { name: 'API Keys', description: 'API key management' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'API Key',
            description: 'API key authentication. Use your project API key.'
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Session cookie authentication for dashboard'
          }
        }
      }
    }
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true
    },
    staticCSP: true
  })
}
