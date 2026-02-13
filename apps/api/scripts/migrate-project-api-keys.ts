#!/usr/bin/env npx tsx
/**
 * Migration Script: Create ApiKey records for existing projects
 *
 * This script ensures all projects with apiKeyHash have a corresponding
 * record in the ApiKey table (for visibility in Settings > API Keys).
 *
 * Usage:
 *   pnpm --filter @agentgov/api migrate:api-keys
 *   # or
 *   npx tsx scripts/migrate-project-api-keys.ts
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --verbose    Show detailed output
 *
 * Safe to run multiple times (idempotent).
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  errors: number
}

async function migrateProjectApiKeys(options: {
  dryRun: boolean
  verbose: boolean
}): Promise<MigrationStats> {
  const { dryRun, verbose } = options
  const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0 }

  console.log('🔑 Starting API Key migration...')
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`)

  // Find all projects with apiKeyHash but no corresponding ApiKey record
  const projects = await prisma.project.findMany({
    where: {
      apiKeyHash: { not: null },
      organizationId: { not: null },
    },
    include: {
      organization: {
        include: {
          members: {
            where: { role: 'owner' },
            take: 1,
          },
        },
      },
      apiKeys: {
        select: { id: true, keyHash: true },
      },
    },
  })

  stats.total = projects.length
  console.log(`📊 Found ${stats.total} projects to check\n`)

  for (const project of projects) {
    // Check if ApiKey record already exists with matching hash
    const existingApiKey = project.apiKeys.find(
      (key) => key.keyHash === project.apiKeyHash
    )

    if (existingApiKey) {
      if (verbose) {
        console.log(`⏭️  SKIP: "${project.name}" - ApiKey record already exists`)
      }
      stats.skipped++
      continue
    }

    // Find the organization owner to use as the API key owner
    const owner = project.organization?.members[0]
    if (!owner) {
      console.error(`❌ ERROR: "${project.name}" - No organization owner found`)
      stats.errors++
      continue
    }

    if (verbose || dryRun) {
      console.log(`${dryRun ? '🔍' : '✅'} ${dryRun ? 'WOULD MIGRATE' : 'MIGRATING'}: "${project.name}"`)
      console.log(`   Project ID: ${project.id}`)
      console.log(`   Organization: ${project.organization?.name}`)
      console.log(`   Owner: ${owner.userId}`)
    }

    if (!dryRun) {
      try {
        await prisma.apiKey.create({
          data: {
            name: `${project.name} - Default Key`,
            keyHash: project.apiKeyHash!,
            keyPrefix: 'ag_live_',
            userId: owner.userId,
            organizationId: project.organizationId!,
            projectId: project.id,
            permissions: ['traces:write', 'traces:read'],
          },
        })
        stats.migrated++
      } catch (error) {
        // Handle unique constraint violation (key already exists)
        if (
          error instanceof Error &&
          error.message.includes('Unique constraint')
        ) {
          if (verbose) {
            console.log(`   ⚠️  Key hash already exists, skipping`)
          }
          stats.skipped++
        } else {
          console.error(`   ❌ Error: ${error}`)
          stats.errors++
        }
      }
    } else {
      stats.migrated++
    }
  }

  return stats
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose') || args.includes('-v')

  try {
    const stats = await migrateProjectApiKeys({ dryRun, verbose })

    console.log('\n📈 Migration Summary:')
    console.log(`   Total projects: ${stats.total}`)
    console.log(`   Migrated: ${stats.migrated}`)
    console.log(`   Skipped (already exists): ${stats.skipped}`)
    console.log(`   Errors: ${stats.errors}`)

    if (dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes')
    } else if (stats.migrated > 0) {
      console.log('\n✅ Migration completed successfully!')
    } else {
      console.log('\n✅ No migration needed - all projects already have ApiKey records')
    }

    process.exit(stats.errors > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
