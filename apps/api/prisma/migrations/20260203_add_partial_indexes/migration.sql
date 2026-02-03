-- Partial indexes for common filtered queries on traces table.
-- These significantly speed up dashboard queries that filter by status,
-- since only matching rows are indexed (much smaller than a full index).
--
-- Note: CREATE INDEX CONCURRENTLY cannot be used here because Prisma
-- runs migrations inside a transaction, and CONCURRENTLY is not allowed
-- within transactions. For zero-downtime deployments on large tables,
-- run these manually outside of Prisma migrate with CONCURRENTLY.

-- Index for active/running traces (commonly queried in real-time dashboards)
CREATE INDEX IF NOT EXISTS "idx_traces_running"
  ON "traces" ("project_id", "started_at")
  WHERE "status" = 'RUNNING';

-- Index for failed traces (commonly queried in error monitoring views)
CREATE INDEX IF NOT EXISTS "idx_traces_failed"
  ON "traces" ("project_id", "created_at")
  WHERE "status" = 'FAILED';
