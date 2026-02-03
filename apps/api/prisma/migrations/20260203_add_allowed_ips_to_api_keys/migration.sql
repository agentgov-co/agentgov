-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[];
