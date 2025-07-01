-- Migration: Add FileStorage system for persistent file management
-- Date: 2025-07-01
-- Description: Adds FileStorage table and related indexes for Cloudflare R2 integration

-- Create FileStorage table
CREATE TABLE "FileStorage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileStorage_pkey" PRIMARY KEY ("id")
);

-- Add FileStorage relation to Tenant table
ALTER TABLE "FileStorage" ADD CONSTRAINT "FileStorage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create unique index on storageKey
CREATE UNIQUE INDEX "FileStorage_storageKey_key" ON "FileStorage"("storageKey");

-- Create performance indexes
CREATE INDEX "FileStorage_tenantId_relatedId_idx" ON "FileStorage"("tenantId", "relatedId");
CREATE INDEX "FileStorage_tenantId_relatedType_idx" ON "FileStorage"("tenantId", "relatedType");
CREATE INDEX "FileStorage_tenantId_createdAt_idx" ON "FileStorage"("tenantId", "createdAt");

-- Add FileStorage relation to Tenant model (this creates the reverse relation)
-- Note: This is handled automatically by Prisma foreign key