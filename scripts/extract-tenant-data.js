// scripts/extract-tenant-data.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();

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

async function extractTenantData(tenantId) {
  console.log(`Extrayendo datos para el tenant: ${tenantId}`);
  
  try {
    // Obtener datos del tenant principal
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    
    if (!tenant) {
      throw new Error(`No se encontró un tenant con ID: ${tenantId}`);
    }

    // Obtener configuraciones del tenant
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenantId }
    });

    // Obtener unidades del tenant
    const units = await prisma.unit.findMany({
      where: { tenantId: tenantId }
    });
    
    // Obtener registros de combustible del tenant
    const fuels = await prisma.fuel.findMany({
      where: { tenantId: tenantId }
    });

    // Crear objeto con todos los datos relacionados
    const tenantData = {
      tenant,
      tenantSettings,
      units,
      fuels
    };

    // Guardar en archivo JSON
    const fileName = `${tenant.companyName.replace(/\s+/g, '_')}_data.json`;
    fs.writeFileSync(fileName, JSON.stringify(tenantData, null, 2));
    
    console.log(`✅ Datos extraídos exitosamente y guardados en: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error(`❌ Error al extraer datos: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    // Obtener todos los tenants para que el usuario elija
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        companyName: true,
        isActive: true,
        isApproved: true
      }
    });
    
    console.log("\n=== Tenants Disponibles ===");
    tenants.forEach((tenant, index) => {
      console.log(`[${index + 1}] ${tenant.companyName} (ID: ${tenant.id})`);
      console.log(`    Estado: ${tenant.isActive ? 'Activo' : 'Inactivo'}, ${tenant.isApproved ? 'Aprobado' : 'No Aprobado'}\n`);
    });
    
    const selectedIndex = parseInt(await askQuestion("\nSelecciona el número del tenant que deseas migrar: ")) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= tenants.length) {
      throw new Error("Selección inválida");
    }
    
    const selectedTenant = tenants[selectedIndex];
    console.log(`\nHas seleccionado: ${selectedTenant.companyName}`);
    
    const confirmation = await askQuestion("¿Estás seguro? (s/n): ");
    if (confirmation.toLowerCase() !== 's') {
      console.log("Operación cancelada");
      process.exit(0);
    }
    
    // Extraer los datos del tenant seleccionado
    const fileName = await extractTenantData(selectedTenant.id);
    
    console.log(`\n=== Instrucciones para Railway ===`);
    console.log(`1. Asegúrate de tener el proyecto creado en Railway`);
    console.log(`2. El archivo ${fileName} contiene todos los datos del tenant seleccionado`);
    console.log(`3. Usa el script 'import-tenant-data.js' (que crearemos a continuación) para importar estos datos a Railway`);
    
  } catch (error) {
    console.error(`Error en la ejecución del script: ${error.message}`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
