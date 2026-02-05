-- Migration: Update MemberRole data to lowercase
-- Part 2: Update existing data (new enum values committed in previous migration)
--
-- This migration updates existing UPPERCASE role values to lowercase
-- to match Better Auth's convention.
--
-- Safe to run multiple times (idempotent).

-- Update members table
UPDATE members SET role = 'owner' WHERE role = 'OWNER';
UPDATE members SET role = 'admin' WHERE role = 'ADMIN';
UPDATE members SET role = 'member' WHERE role = 'MEMBER';

-- Update invitations table
UPDATE invitations SET role = 'owner' WHERE role = 'OWNER';
UPDATE invitations SET role = 'admin' WHERE role = 'ADMIN';
UPDATE invitations SET role = 'member' WHERE role = 'MEMBER';

-- Note: Old enum values (OWNER, ADMIN, MEMBER) will remain in PostgreSQL
-- but won't be used. This is safe - Prisma will only use lowercase values.
