#!/usr/bin/env npx tsx
/**
 * Migration: Lowercase MemberRole enum
 *
 * This migration changes MemberRole enum from UPPERCASE to lowercase
 * to match Better Auth's convention.
 *
 * Usage:
 *   pnpm --filter @agentgov/api migrate:member-role
 *   # or
 *   npx tsx scripts/migrate-member-role-enum.ts
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *
 * Safe to run multiple times (idempotent).
 */

import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function migrateMemberRoleEnum(dryRun: boolean): Promise<void> {
  const client = await pool.connect()

  console.log('🔄 Starting MemberRole enum migration...')
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`)

  try {
    // Check current enum values
    const enumResult = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = '"MemberRole"'::regtype
      ORDER BY enumsortorder
    `)
    const currentValues = enumResult.rows.map(r => r.enumlabel)
    console.log(`📋 Current enum values: ${currentValues.join(', ')}`)

    // Check if migration is needed
    const hasLowercase = currentValues.includes('owner')
    const hasUppercase = currentValues.includes('OWNER')

    if (hasLowercase && !hasUppercase) {
      console.log('\n✅ Migration already complete - enum uses lowercase values')
      return
    }

    if (!hasUppercase && !hasLowercase) {
      console.error('\n❌ Unexpected enum state - neither OWNER nor owner found')
      process.exit(1)
    }

    // Count affected rows
    const membersCount = await client.query(`
      SELECT COUNT(*) as count FROM members WHERE role IN ('OWNER', 'ADMIN', 'MEMBER')
    `)
    const invitationsCount = await client.query(`
      SELECT COUNT(*) as count FROM invitations WHERE role IN ('OWNER', 'ADMIN', 'MEMBER')
    `)

    console.log(`\n📊 Affected rows:`)
    console.log(`   members: ${membersCount.rows[0].count}`)
    console.log(`   invitations: ${invitationsCount.rows[0].count}`)

    if (dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes')
      return
    }

    // Start transaction
    await client.query('BEGIN')

    // Step 1: Add new lowercase values (if they don't exist)
    if (!hasLowercase) {
      console.log('\n🔧 Adding lowercase enum values...')

      // Note: ADD VALUE cannot run inside transaction in some PG versions
      // So we commit, add values, then start new transaction for data migration
      await client.query('COMMIT')

      for (const value of ['owner', 'admin', 'member']) {
        try {
          await client.query(`ALTER TYPE "MemberRole" ADD VALUE '${value}'`)
          console.log(`   ✓ Added '${value}'`)
        } catch (error) {
          // Value might already exist
          if (error instanceof Error && error.message.includes('already exists')) {
            console.log(`   ⏭️  '${value}' already exists`)
          } else {
            throw error
          }
        }
      }

      await client.query('BEGIN')
    }

    // Step 2: Update data to lowercase
    console.log('\n🔧 Updating data to lowercase...')

    const updates = [
      { table: 'members', from: 'OWNER', to: 'owner' },
      { table: 'members', from: 'ADMIN', to: 'admin' },
      { table: 'members', from: 'MEMBER', to: 'member' },
      { table: 'invitations', from: 'OWNER', to: 'owner' },
      { table: 'invitations', from: 'ADMIN', to: 'admin' },
      { table: 'invitations', from: 'MEMBER', to: 'member' },
    ]

    for (const { table, from, to } of updates) {
      const result = await client.query(
        `UPDATE ${table} SET role = $1 WHERE role = $2`,
        [to, from]
      )
      if (result.rowCount && result.rowCount > 0) {
        console.log(`   ✓ ${table}: ${from} → ${to} (${result.rowCount} rows)`)
      }
    }

    await client.query('COMMIT')

    console.log('\n✅ Migration completed successfully!')
    console.log('\n⚠️  Note: Old enum values (OWNER, ADMIN, MEMBER) still exist in PostgreSQL')
    console.log('   but will not be used. This is safe and expected.')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Main
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

migrateMemberRoleEnum(dryRun)
