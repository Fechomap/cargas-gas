// scripts/migrate-to-postgres.js
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

// Cargar variables de entorno
dotenv.config();

// Inicializar clientes
const prisma = new PrismaClient();
const mongoUrl = process.env.MONGODB_URI;

// Modelos de MongoDB (importamos directamente desde los archivos)
import { Unit } from '../src/models/unit.model.js';
import { Fuel } from '../src/models/fuel.model.js';

/**
 * Función principal de migración
 */
async function migrateData() {
  console.log('🚀 Iniciando migración de MongoDB a PostgreSQL...');
  
  try {
    // Conectar a MongoDB
    await mongoose.connect(mongoUrl);
    console.log('✅ Conectado a MongoDB');
    
    // Crear un tenant por defecto (primer tenant)
    const defaultTenant = await createDefaultTenant();
    console.log(`✅ Tenant por defecto creado con ID: ${defaultTenant.id}`);
    
    // Migrar unidades
    await migrateUnits(defaultTenant.id);
    
    // Migrar cargas de combustible
    await migrateFuels(defaultTenant.id);
    
    console.log('✅ Migración completada exitosamente');
    
    // Guardar registro del proceso
    await fs.writeFile(
      './migration-log.json', 
      JSON.stringify({
        date: new Date().toISOString(),
        status: 'success',
        tenantId: defaultTenant.id
      }, null, 2)
    );
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    
    // Guardar registro del error
    await fs.writeFile(
      './migration-error-log.json', 
      JSON.stringify({
        date: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      }, null, 2)
    );
    
  } finally {
    // Cerrar conexiones
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

/**
 * Crea un tenant predeterminado
 */
async function createDefaultTenant() {
  // Verificar si ya existe un tenant por default
  const existingTenant = await prisma.tenant.findFirst();
  if (existingTenant) {
    console.log('➡️ Usando tenant existente');
    return existingTenant;
  }
  
  // Crear tenant por defecto
  const chatId = process.env.DEFAULT_CHAT_ID || 'default_chat_id';
  const companyName = process.env.DEFAULT_COMPANY_NAME || 'Empresa Default';
  
  const tenant = await prisma.tenant.create({
    data: {
      chatId,
      companyName,
      settings: {
        create: {
          // Configuración por defecto
          currency: 'MXN',
          timezone: 'America/Mexico_City',
          allowPhotoSkip: true,
          requireSaleNumber: true
        }
      }
    },
    include: {
      settings: true
    }
  });
  
  console.log(`➡️ Tenant creado: ${tenant.companyName}`);
  return tenant;
}

/**
 * Migra las unidades de MongoDB a PostgreSQL
 */
async function migrateUnits(tenantId) {
  console.log('➡️ Migrando unidades...');
  
  // Obtener todas las unidades de MongoDB
  const mongoUnits = await Unit.find({});
  console.log(`📊 Total de unidades a migrar: ${mongoUnits.length}`);
  
  // Migrar cada unidad
  for (const mongoUnit of mongoUnits) {
    const unitData = {
      operatorName: mongoUnit.operatorName,
      unitNumber: mongoUnit.unitNumber,
      buttonId: mongoUnit.buttonId,
      isActive: mongoUnit.isActive,
      tenantId,
      // Preservar fechas originales
      createdAt: mongoUnit.createdAt,
      updatedAt: mongoUnit.updatedAt
    };
    
    // Crear en PostgreSQL
    const unit = await prisma.unit.create({
      data: unitData
    });
    
    console.log(`✅ Unidad migrada: ${unit.operatorName} (${unit.unitNumber})`);
  }
}

/**
 * Migra las cargas de combustible de MongoDB a PostgreSQL
 */
async function migrateFuels(tenantId) {
  console.log('➡️ Migrando cargas de combustible...');
  
  // Obtener todas las cargas de MongoDB
  const mongoFuels = await Fuel.find({}).populate('unitId');
  console.log(`📊 Total de cargas a migrar: ${mongoFuels.length}`);
  
  // Mapeo para IDs de unidades
  const unitMappings = new Map();
  
  // Obtener mapeo de IDs antiguos a nuevos
  const units = await prisma.unit.findMany({
    where: { tenantId }
  });
  
  // Buscar correspondencias por buttonId
  for (const unit of units) {
    const mongoUnit = await Unit.findOne({ buttonId: unit.buttonId });
    if (mongoUnit) {
      unitMappings.set(mongoUnit._id.toString(), unit.id);
    }
  }
  
  // Migrar cada carga
  let migratedCount = 0;
  
  for (const mongoFuel of mongoFuels) {
    try {
      // Obtener el nuevo ID de la unidad
      const oldUnitId = mongoFuel.unitId._id.toString();
      const newUnitId = unitMappings.get(oldUnitId);
      
      if (!newUnitId) {
        console.warn(`⚠️ No se encontró correspondencia para la unidad con ID: ${oldUnitId}`);
        continue;
      }
      
      // Crear datos para el nuevo registro
      const fuelData = {
        tenantId,
        unitId: newUnitId,
        liters: mongoFuel.liters,
        amount: mongoFuel.amount,
        fuelType: mongoFuel.fuelType.toUpperCase(),
        saleNumber: mongoFuel.saleNumber,
        paymentStatus: mongoFuel.paymentStatus === 'pagada' ? 'PAGADA' : 'NO_PAGADA',
        paymentDate: mongoFuel.paymentDate,
        ticketPhoto: mongoFuel.ticketPhoto,
        recordDate: mongoFuel.recordDate,
        operatorName: mongoFuel.operatorName || mongoFuel.unitId.operatorName,
        unitNumber: mongoFuel.unitNumber || mongoFuel.unitId.unitNumber,
        createdAt: mongoFuel.createdAt,
        updatedAt: mongoFuel.updatedAt
      };
      
      // Crear en PostgreSQL
      await prisma.fuel.create({
        data: fuelData
      });
      
      migratedCount++;
      
      if (migratedCount % 50 === 0) {
        console.log(`✅ Migradas ${migratedCount} de ${mongoFuels.length} cargas`);
      }
      
    } catch (error) {
      console.error(`❌ Error al migrar carga: ${error.message}`);
    }
  }
  
  console.log(`✅ Migración de cargas completada: ${migratedCount} de ${mongoFuels.length}`);
}

// Ejecutar migración
migrateData()
  .then(() => {
    console.log('📋 Proceso finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error en el proceso principal:', error);
    process.exit(1);
  });
