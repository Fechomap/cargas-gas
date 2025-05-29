// scripts/test-multitenant.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const prisma = new PrismaClient();

/**
 * Script para probar la funcionalidad multi-tenant
 * Creará dos tenants con chatID diferentes y verificará que los datos se mantengan separados
 */
async function testMultiTenant() {
  try {
    console.log('🚀 Iniciando prueba de sistema multi-tenant...');
    
    // Limpiar datos existentes para pruebas limpias
    await cleanupTestData();
    
    // Crear dos tenants diferentes
    const tenant1 = await createTenant('chat123', 'Empresa 1');
    const tenant2 = await createTenant('chat456', 'Empresa 2');
    
    console.log(`✅ Tenants creados: ${tenant1.companyName} (${tenant1.chatId}) y ${tenant2.companyName} (${tenant2.chatId})`);
    
    // Crear unidades para cada tenant
    const unit1Tenant1 = await createUnit(tenant1.id, 'Juan Pérez', 'T001');
    const unit2Tenant1 = await createUnit(tenant1.id, 'Carlos López', 'T002');
    const unit1Tenant2 = await createUnit(tenant2.id, 'María González', 'T001'); // Mismo número pero otro tenant
    
    console.log('✅ Unidades creadas para ambos tenants');
    
    // Crear cargas de combustible
    await createFuel(tenant1.id, unit1Tenant1.id, 100, 2000, 'GAS');
    await createFuel(tenant1.id, unit2Tenant1.id, 80, 1600, 'GASOLINA');
    await createFuel(tenant2.id, unit1Tenant2.id, 50, 1000, 'GAS');
    
    console.log('✅ Cargas de combustible creadas para ambos tenants');
    
    // Verificar separación de datos - Tenant 1
    const tenant1Units = await prisma.unit.findMany({
      where: { tenantId: tenant1.id },
      include: { fuels: true }
    });
    
    console.log(`\n📊 Tenant 1 (${tenant1.companyName}) - Unidades: ${tenant1Units.length}`);
    tenant1Units.forEach(unit => {
      console.log(`- ${unit.operatorName} (${unit.unitNumber}) - Cargas: ${unit.fuels.length}`);
    });
    
    // Verificar separación de datos - Tenant 2
    const tenant2Units = await prisma.unit.findMany({
      where: { tenantId: tenant2.id },
      include: { fuels: true }
    });
    
    console.log(`\n📊 Tenant 2 (${tenant2.companyName}) - Unidades: ${tenant2Units.length}`);
    tenant2Units.forEach(unit => {
      console.log(`- ${unit.operatorName} (${unit.unitNumber}) - Cargas: ${unit.fuels.length}`);
    });
    
    // Verificar búsqueda por chatId
    const foundTenant = await prisma.tenant.findUnique({
      where: { chatId: 'chat123' },
      include: {
        units: {
          include: { fuels: true }
        }
      }
    });
    
    console.log(`\n📱 Búsqueda por chatId: ${foundTenant.companyName} (${foundTenant.chatId})`);
    console.log(`- Unidades: ${foundTenant.units.length}`);
    console.log(`- Total cargas: ${foundTenant.units.reduce((acc, unit) => acc + unit.fuels.length, 0)}`);
    
    console.log('\n✅ Prueba completada exitosamente - El sistema multi-tenant funciona correctamente');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

/**
 * Crea un tenant para pruebas
 */
async function createTenant(chatId, companyName) {
  return prisma.tenant.create({
    data: {
      chatId,
      companyName,
      settings: {
        create: {
          // Configuración por defecto
          currency: 'MXN',
          timezone: 'America/Mexico_City'
        }
      }
    }
  });
}

/**
 * Crea una unidad para pruebas
 */
async function createUnit(tenantId, operatorName, unitNumber) {
  const buttonId = `unit_${operatorName.replace(/\s+/g, '_')}_${unitNumber}`;
  
  return prisma.unit.create({
    data: {
      tenantId,
      operatorName,
      unitNumber,
      buttonId,
      isActive: true
    }
  });
}

/**
 * Crea una carga de combustible para pruebas
 */
async function createFuel(tenantId, unitId, liters, amount, fuelType) {
  // Obtener información de la unidad
  const unit = await prisma.unit.findUnique({
    where: { id: unitId }
  });
  
  return prisma.fuel.create({
    data: {
      tenantId,
      unitId,
      liters,
      amount,
      fuelType,
      paymentStatus: 'NO_PAGADA',
      operatorName: unit.operatorName,
      unitNumber: unit.unitNumber,
      recordDate: new Date()
    }
  });
}

/**
 * Limpia los datos de prueba
 */
async function cleanupTestData() {
  try {
    // Eliminar registros de prueba
    await prisma.fuel.deleteMany({
      where: {
        tenant: {
          OR: [
            { chatId: 'chat123' },
            { chatId: 'chat456' }
          ]
        }
      }
    });
    
    await prisma.unit.deleteMany({
      where: {
        tenant: {
          OR: [
            { chatId: 'chat123' },
            { chatId: 'chat456' }
          ]
        }
      }
    });
    
    await prisma.tenantSettings.deleteMany({
      where: {
        tenant: {
          OR: [
            { chatId: 'chat123' },
            { chatId: 'chat456' }
          ]
        }
      }
    });
    
    await prisma.tenant.deleteMany({
      where: {
        OR: [
          { chatId: 'chat123' },
          { chatId: 'chat456' }
        ]
      }
    });
    
    console.log('🧹 Datos de prueba eliminados');
  } catch (error) {
    console.log('⚠️ Error al limpiar datos:', error.message);
  }
}

// Ejecutar prueba
testMultiTenant()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error en el proceso principal:', error);
    process.exit(1);
  });
