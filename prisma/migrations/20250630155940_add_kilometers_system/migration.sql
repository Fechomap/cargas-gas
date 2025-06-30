-- Migración incremental para Sistema de Kilómetros
-- SOLO los cambios nuevos para Railway

-- Crear enum KilometerLogType
CREATE TYPE "KilometerLogType" AS ENUM ('INICIO_TURNO', 'FIN_TURNO');

-- Agregar columnas nuevas a tabla Fuel (nullable para compatibilidad)
ALTER TABLE "Fuel" ADD COLUMN "kilometers" DECIMAL(10,2);
ALTER TABLE "Fuel" ADD COLUMN "pricePerLiter" DECIMAL(10,2);

-- Crear tabla KilometerLog
CREATE TABLE "KilometerLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kilometers" DECIMAL(10,2) NOT NULL,
    "logType" "KilometerLogType" NOT NULL,
    "logDate" DATE NOT NULL,
    "logTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "isOmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KilometerLog_pkey" PRIMARY KEY ("id")
);

-- Crear índices para KilometerLog
CREATE INDEX "KilometerLog_tenantId_logDate_idx" ON "KilometerLog"("tenantId", "logDate");
CREATE INDEX "KilometerLog_unitId_logDate_idx" ON "KilometerLog"("unitId", "logDate");
CREATE UNIQUE INDEX "KilometerLog_tenantId_unitId_logDate_logType_key" ON "KilometerLog"("tenantId", "unitId", "logDate", "logType");

-- Crear foreign keys para KilometerLog
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;