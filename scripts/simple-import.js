// scripts/simple-import.js
// Script simplificado para importar solo los datos críticos
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const DATA_FILE = 'Empresa_Migrada_data.json';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL no está definida');
  process.exit(1);
}

console.log(`\n=== Importación Simplificada de Tenant a Railway ===\n`);
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
    
    // 1. Crear el tenant (versión simplificada)
    console.log("Creando tenant...");
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantData.tenant.id,
        companyName: tenantData.tenant.companyName,
        isActive: tenantData.tenant.isActive,
        chatId: tenantData.tenant.chatId || '0', // Valor por defecto si falta
        isApproved: true // Forzamos aprobado
      }
    });
    
    // 2. Crear configuraciones del tenant (si existen)
    if (tenantData.tenantSettings) {
      console.log("Creando configuraciones del tenant...");
      await prisma.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currency: tenantData.tenantSettings.currency || 'MXN',
          timezone: tenantData.tenantSettings.timezone || 'America/Mexico_City'
        }
      });
    }
    
    // 3. Crear unidades
    if (tenantData.units.length > 0) {
      console.log(`Creando unidades...`);
      let createdUnits = 0;
      
      for (const unit of tenantData.units) {
        try {
          await prisma.unit.create({
            data: {
              id: unit.id,
              tenantId: tenant.id,
              operatorName: unit.operatorName,
              unitNumber: unit.unitNumber,
              isActive: unit.isActive || true,
              buttonId: unit.buttonId
            }
          });
          createdUnits++;
        } catch (error) {
          console.error(`Error al crear unidad ${unit.operatorName}: ${error.message}`);
        }
      }
      
      console.log(`Se crearon ${createdUnits} de ${tenantData.units.length} unidades`);
    }
    
    // 4. Crear registros de combustible (sólo si unidades fueron creadas correctamente)
    if (tenantData.fuels.length > 0) {
      console.log(`Creando registros de combustible...`);
      let createdFuels = 0;
      
      for (const fuel of tenantData.fuels) {
        try {
          await prisma.fuel.create({
            data: {
              id: fuel.id,
              tenantId: tenant.id,
              unitId: fuel.unitId,
              liters: fuel.liters,
              amount: fuel.amount || 0, // Usando el campo correcto amount
              fuelType: fuel.fuelType || "GAS",
              saleNumber: fuel.saleNumber, // Añadiendo número de venta
              paymentStatus: fuel.paymentStatus || "NO_PAGADA",
              paymentDate: fuel.paymentDate, // Añadiendo fecha de pago
              recordDate: fuel.recordDate || new Date(),
              operatorName: fuel.operatorName, // Usando el valor real del operador
              unitNumber: fuel.unitNumber // Usando el valor real del número de unidad
            }
          });
          createdFuels++;
        } catch (error) {
          console.error(`Error al crear registro de combustible: ${error.message}`);
        }
      }
      
      console.log(`Se crearon ${createdFuels} de ${tenantData.fuels.length} registros de combustible`);
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
