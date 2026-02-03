import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Explicit connection pool with configurable limits
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: 5_000,
})

// Create Prisma adapter with pg Pool
const adapter = new PrismaPg(pool)

// Prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createPrismaClient() {
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error']
  })

  // Soft delete extension for compliance models
  return client.$extends({
    query: {
      aISystem: {
        async delete({ args }) {
          return client.aISystem.update({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async deleteMany({ args }) {
          return client.aISystem.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findUnique({ args, query }) {
          return query(args)
        },
      },
      incidentReport: {
        async delete({ args }) {
          return client.incidentReport.update({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async deleteMany({ args }) {
          return client.incidentReport.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findUnique({ args, query }) {
          return query(args)
        },
      },
      complianceDocument: {
        async delete({ args }) {
          return client.complianceDocument.update({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async deleteMany({ args }) {
          return client.complianceDocument.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as never
        },
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findUnique({ args, query }) {
          return query(args)
        },
      },
      complianceObligation: {
        async delete() {
          throw new Error('Hard delete not allowed on compliance data')
        },
        async deleteMany() {
          throw new Error('Hard delete not allowed on compliance data')
        },
      },
      humanOversightConfig: {
        async delete() {
          throw new Error('Hard delete not allowed on compliance data')
        },
        async deleteMany() {
          throw new Error('Hard delete not allowed on compliance data')
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Graceful shutdown: close the pg pool.
 * Call this on SIGTERM/SIGINT before process exit.
 */
export async function closePool(): Promise<void> {
  await pool.end()
}
