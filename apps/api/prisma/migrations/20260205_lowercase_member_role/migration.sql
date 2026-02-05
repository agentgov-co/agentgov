-- Migration: Lowercase MemberRole enum values
-- This migration changes MemberRole enum from UPPERCASE to lowercase
-- to match Better Auth's convention.
--
-- Safe to run multiple times (idempotent).

-- Step 1: Add new lowercase values to enum (if they don't exist)
DO $$
BEGIN
    -- Add 'owner' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'owner' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'owner';
    END IF;

    -- Add 'admin' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'admin';
    END IF;

    -- Add 'member' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'member' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'member';
    END IF;
END
$$;

-- Step 2: Update existing data to lowercase values
UPDATE members SET role = 'owner' WHERE role = 'OWNER';
UPDATE members SET role = 'admin' WHERE role = 'ADMIN';
UPDATE members SET role = 'member' WHERE role = 'MEMBER';

UPDATE invitations SET role = 'owner' WHERE role = 'OWNER';
UPDATE invitations SET role = 'admin' WHERE role = 'ADMIN';
UPDATE invitations SET role = 'member' WHERE role = 'MEMBER';

-- Note: We cannot remove old enum values in PostgreSQL without recreating the type.
-- The old values (OWNER, ADMIN, MEMBER) will remain but won't be used.
-- This is safe - Prisma will only use the lowercase values going forward.
