-- Migration: Add lowercase MemberRole enum values
-- Part 1: Add new enum values (must commit before use)
--
-- This migration adds lowercase enum values to match Better Auth's convention.
-- The UPDATE statements are in a separate migration because PostgreSQL requires
-- new enum values to be committed before they can be used.

-- Add 'owner' if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'owner' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'owner';
    END IF;
END
$$;

-- Add 'admin' if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'admin';
    END IF;
END
$$;

-- Add 'member' if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'member' AND enumtypid = '"MemberRole"'::regtype) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'member';
    END IF;
END
$$;
