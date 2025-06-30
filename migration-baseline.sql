-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GAS', 'GASOLINA', 'DIESEL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAGADA', 'NO_PAGADA');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KilometerLogType" AS ENUM ('INICIO_TURNO', 'FIN_TURNO');

-- CreateTable
CREATE TABLE "Fuel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "liters" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "kilometers" DECIMAL(10,2),
    "pricePerLiter" DECIMAL(10,2),
    "fuelType" "FuelType" NOT NULL,
    "saleNumber" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NO_PAGADA',
    "paymentDate" TIMESTAMP(3),
    "ticketPhoto" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorName" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Fuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "requesterId" TEXT NOT NULL,
    "requesterUsername" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "registrationToken" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "allowPhotoSkip" BOOLEAN NOT NULL DEFAULT true,
    "requireSaleNumber" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX "Fuel_tenantId_paymentStatus_idx" ON "Fuel"("tenantId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Fuel_tenantId_recordDate_idx" ON "Fuel"("tenantId", "recordDate");

-- CreateIndex
CREATE INDEX "Fuel_tenantId_saleNumber_idx" ON "Fuel"("tenantId", "saleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_chatId_key" ON "Tenant"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_registrationToken_key" ON "Tenant"("registrationToken");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE INDEX "Unit_tenantId_operatorName_idx" ON "Unit"("tenantId", "operatorName");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_tenantId_buttonId_key" ON "Unit"("tenantId", "buttonId");

-- CreateIndex
CREATE INDEX "KilometerLog_tenantId_logDate_idx" ON "KilometerLog"("tenantId", "logDate");

-- CreateIndex
CREATE INDEX "KilometerLog_unitId_logDate_idx" ON "KilometerLog"("unitId", "logDate");

-- CreateIndex
CREATE UNIQUE INDEX "KilometerLog_tenantId_unitId_logDate_logType_key" ON "KilometerLog"("tenantId", "unitId", "logDate", "logType");

-- AddForeignKey
ALTER TABLE "Fuel" ADD CONSTRAINT "Fuel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fuel" ADD CONSTRAINT "Fuel_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

