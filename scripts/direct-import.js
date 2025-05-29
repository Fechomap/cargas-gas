// scripts/direct-import.js
// Script de importación directa sin interacción
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const DATA_FILE = 'Empresa_Migrada_data.json';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL no está definida');
  process.exit(1);
}

console.log(`\n=== Importación Directa de Datos de Tenant a Railway ===\n`);
console.log(`Usando archivo: ${DATA_FILE}`);
console.log(`URL de base de datos: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

async function importTenantData() {
  // Crear una nueva instancia de Prisma con la URL de Railway
  const prisma = new PrismaClient();
  
  try {
    // Leer datos del archivo JSON
    console.log(`\nLeyendo datos desde: ${DATA_FILE}`);
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const tenantData = JSON.parse(rawData);
    
    console.log(`\nDatos a importar:`);
    console.log(`- Tenant: ${tenantData.tenant.companyName}`);
    console.log(`- Configuraciones: ${tenantData.tenantSettings ? 'Sí' : 'No'}`);
    console.log(`- Unidades: ${tenantData.units.length}`);
    console.log(`- Registros de combustible: ${tenantData.fuels.length}`);
    
    console.log("\n==== Iniciando proceso de importación ====");
    
    // 1. Crear el tenant
    console.log("Creando tenant...");
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantData.tenant.id,
        companyName: tenantData.tenant.companyName,
        isActive: tenantData.tenant.isActive,
        isApproved: tenantData.tenant.isApproved,
        chatId: tenantData.tenant.chatId,
        registrationToken: null // No trasladar el token por seguridad
      }
    });
    
    // 2. Crear configuraciones del tenant
    if (tenantData.tenantSettings) {
      console.log("Creando configuraciones del tenant...");
      await prisma.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currency: tenantData.tenantSettings.currency,
          timezone: tenantData.tenantSettings.timezone,
          dateFormat: tenantData.tenantSettings.dateFormat,
          decimalSeparator: tenantData.tenantSettings.decimalSeparator
        }
      });
    }
    
    // 3. Crear unidades
    if (tenantData.units.length > 0) {
      console.log(`Creando ${tenantData.units.length} unidades...`);
      for (const unit of tenantData.units) {
        await prisma.unit.create({
          data: {
            id: unit.id,
            tenantId: tenant.id,
            operatorName: unit.operatorName,
            unitNumber: unit.unitNumber,
            isActive: unit.isActive,
            buttonId: unit.buttonId
          }
        });
      }
    }
    
    // 4. Crear registros de combustible
    if (tenantData.fuels.length > 0) {
      console.log(`Creando ${tenantData.fuels.length} registros de combustible...`);
      for (const fuel of tenantData.fuels) {
        await prisma.fuel.create({
          data: {
            id: fuel.id,
            tenantId: tenant.id,
            unitId: fuel.unitId,
            liters: fuel.liters,
            cost: fuel.cost,
            date: fuel.date,
            odometerReading: fuel.odometerReading,
            paymentStatus: fuel.paymentStatus,
            fuelType: fuel.fuelType || "REGULAR",
            notes: fuel.notes || ""
          }
        });
      }
    }
    
    console.log("\n✅ Importación completada exitosamente");
    console.log(`El tenant '${tenant.companyName}' está ahora disponible en la base de datos de Railway`);
    
  } catch (error) {
    console.error(`\n❌ Error durante la importación: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la importación
importTenantData()
  .catch(e => {
    console.error(`Error fatal: ${e.message}`);
    process.exit(1);
  });
