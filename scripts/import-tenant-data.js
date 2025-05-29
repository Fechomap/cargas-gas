// scripts/import-tenant-data.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

// Crear interfaz para leer entrada del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para preguntar al usuario
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

async function importTenantData(filePath, railwayDatabaseUrl) {
  console.log(`Importando datos desde: ${filePath}`);
  
  // Crear una nueva instancia de Prisma con la URL de Railway
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: railwayDatabaseUrl
      }
    }
  });
  
  try {
    // Leer datos del archivo JSON
    const rawData = fs.readFileSync(filePath, 'utf8');
    const tenantData = JSON.parse(rawData);
    
    console.log(`\nDatos a importar:`);
    console.log(`- Tenant: ${tenantData.tenant.companyName}`);
    console.log(`- Configuraciones: ${tenantData.tenantSettings ? 'Sí' : 'No'}`);
    console.log(`- Unidades: ${tenantData.units.length}`);
    console.log(`- Registros de combustible: ${tenantData.fuels.length}`);
    
    // Confirmación final
    const confirmation = await askQuestion("\n¿Proceder con la importación? (s/n): ");
    if (confirmation.toLowerCase() !== 's') {
      console.log("Importación cancelada");
      return;
    }
    
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
    console.error(`❌ Error durante la importación: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

async function main() {
  try {
    console.log("\n=== Importación de Datos de Tenant a Railway ===\n");
    
    // Solicitar ruta del archivo de datos
    const filePath = await askQuestion("Ruta del archivo JSON con los datos del tenant: ");
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo no existe: ${filePath}`);
    }
    
    // Solicitar URL de la base de datos de Railway
    console.log("\nNecesitas la DATABASE_URL de tu proyecto en Railway.");
    console.log("Puedes obtenerla desde el panel de Railway > Tu proyecto > PostgreSQL > Variables > DATABASE_URL");
    const railwayDatabaseUrl = await askQuestion("\nIngresa la DATABASE_URL de Railway: ");
    
    if (!railwayDatabaseUrl.startsWith("postgresql://")) {
      throw new Error("La URL de la base de datos no parece ser válida. Debe comenzar con 'postgresql://'");
    }
    
    // Importar los datos
    await importTenantData(filePath, railwayDatabaseUrl);
    
  } catch (error) {
    console.error(`Error en la ejecución del script: ${error.message}`);
  }
}

main();
