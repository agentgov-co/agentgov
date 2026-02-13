-- Add external_id column to traces table for idempotency support
-- This allows SDKs (like OpenAI Agents) to send the same trace multiple times
-- without creating duplicates

-- Add the column (nullable to support existing traces)
ALTER TABLE "traces" ADD COLUMN "external_id" TEXT;

-- Create unique constraint: external_id must be unique within a project
-- NULL values are allowed and don't conflict (multiple traces can have NULL external_id)
CREATE UNIQUE INDEX "traces_project_id_external_id_key" ON "traces"("project_id", "external_id");
