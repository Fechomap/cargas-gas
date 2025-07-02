-- Script para agregar tabla AuditLog
-- Fecha: 2025-07-02
-- Descripción: Agrega sistema de auditoría para registrar cambios administrativos

-- Crear tabla AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_userId_idx" ON "AuditLog"("tenantId", "userId");

-- Agregar foreign key con Tenant
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" 
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verificar que la tabla se creó correctamente
SELECT 
    'AuditLog table created successfully' as status,
    COUNT(*) as index_count
FROM 
    pg_indexes 
WHERE 
    tablename = 'AuditLog';