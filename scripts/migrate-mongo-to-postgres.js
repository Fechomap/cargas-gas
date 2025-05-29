// scripts/migrate-mongo-to-postgres.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger.js';

// Importar modelos de MongoDB
import { Unit } from '../src/models/unit.model.js';
import { Fuel } from '../src/models/fuel.model.js';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';

// Inicializar cliente de Prisma
const prisma = new PrismaClient();

// Configuración
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const MIGRATION_LOG_FILE = path.join(LOG_DIR, `migration_log_${formatDateForFilename(new Date())}.json`);
const MIGRATION_ERRORS_FILE = path.join(LOG_DIR, `migration_errors_${formatDateForFilename(new Date())}.json`);

// Estadísticas de migración
const stats = {
  tenants: { total: 0, migrated: 0, errors: 0 },
  units: { total: 0, migrated: 0, errors: 0 },
  fuels: { total: 0, migrated: 0, errors: 0 },
  startTime: new Date(),
  endTime: null,
  durationSeconds: 0
};

// Registros de errores
const errors = {
  tenants: [],
  units: [],
  fuels: []
};

// Mapeos para IDs (MongoDB a PostgreSQL)
const idMappings = {
  units: new Map() // Map de ObjectId de MongoDB a UUID de PostgreSQL
};

/**
 * Función principal de migración
 */
async function migrateData() {
  try {
    logger.info('=== INICIANDO MIGRACIÓN DE MONGODB A POSTGRESQL ===');
    logger.info(`Fecha y hora: ${stats.startTime.toLocaleString()}`);
    
    // Crear directorio de logs si no existe
    await fs.mkdir(LOG_DIR, { recursive: true });
    
    // Conectar a MongoDB
    logger.info('Conectando a MongoDB...');
    await connectToDatabase();
    logger.info('Conexión exitosa a MongoDB');
    
    // Verificar conexión a PostgreSQL
    logger.info('Verificando conexión a PostgreSQL...');
    await prisma.$connect();
    logger.info('Conexión exitosa a PostgreSQL');
    
    // Migrar datos
    logger.info('Iniciando migración de datos...');
    
    // 1. Crear tenant por defecto (para la migración inicial)
    const tenant = await createDefaultTenant();
    stats.tenants.migrated++;
    
    // 2. Migrar unidades
    await migrateUnits(tenant.id);
    
    // 3. Migrar cargas de combustible
    await migrateFuels(tenant.id);
    
    // Calcular estadísticas finales
    stats.endTime = new Date();
    stats.durationSeconds = (stats.endTime - stats.startTime) / 1000;
    
    // Guardar log de migración
    await fs.writeFile(MIGRATION_LOG_FILE, JSON.stringify(stats, null, 2));
    
    // Guardar log de errores si hay alguno
    if (errors.units.length > 0 || errors.fuels.length > 0) {
      await fs.writeFile(MIGRATION_ERRORS_FILE, JSON.stringify(errors, null, 2));
      logger.warn(`Se encontraron errores durante la migración. Ver: ${MIGRATION_ERRORS_FILE}`);
    }
    
    // Resumen
    logger.info('=== RESUMEN DE MIGRACIÓN ===');
    logger.info(`Tenants: ${stats.tenants.migrated}/${stats.tenants.total} (${stats.tenants.errors} errores)`);
    logger.info(`Unidades: ${stats.units.migrated}/${stats.units.total} (${stats.units.errors} errores)`);
    logger.info(`Cargas: ${stats.fuels.migrated}/${stats.fuels.total} (${stats.fuels.errors} errores)`);
    logger.info(`Tiempo total: ${stats.durationSeconds.toFixed(2)} segundos`);
    logger.info('=== MIGRACIÓN COMPLETADA ===');
    
  } catch (error) {
    logger.error(`Error durante la migración: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Desconectar de las bases de datos
    await disconnectFromDatabase();
    await prisma.$disconnect();
  }
}

/**
 * Crea un tenant por defecto para la migración inicial
 */
async function createDefaultTenant() {
  logger.info('Creando tenant por defecto...');
  
  // Verificar si ya existe un tenant con el chatId predeterminado
  const chatId = process.env.TELEGRAM_GROUP_ID || 'default_chat_id';
  const existingTenant = await prisma.tenant.findUnique({
    where: { chatId }
  });
  
  if (existingTenant) {
    logger.info(`Tenant ya existe: ${existingTenant.companyName} (${existingTenant.chatId})`);
    stats.tenants.total++;
    return existingTenant;
  }
  
  // Crear nuevo tenant por defecto
  const newTenant = await prisma.tenant.create({
    data: {
      chatId,
      companyName: process.env.DEFAULT_COMPANY_NAME || 'Empresa Migrada',
      settings: {
        create: {
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
  
  logger.info(`Tenant creado: ${newTenant.companyName} (${newTenant.chatId})`);
  stats.tenants.total++;
  
  return newTenant;
}

/**
 * Migra las unidades de MongoDB a PostgreSQL
 */
async function migrateUnits(tenantId) {
  try {
    logger.info('Migrando unidades...');
    
    // Obtener todas las unidades de MongoDB
    const mongoUnits = await Unit.find({});
    stats.units.total = mongoUnits.length;
    logger.info(`Total de unidades a migrar: ${mongoUnits.length}`);
    
    // Contador de progreso
    let counter = 0;
    
    // Migrar cada unidad
    for (const mongoUnit of mongoUnits) {
      try {
        counter++;
        
        // Verificar si la unidad ya existe (por buttonId)
        const existingUnit = await prisma.unit.findUnique({
          where: {
            tenantId_buttonId: {
              tenantId,
              buttonId: mongoUnit.buttonId
            }
          }
        });
        
        if (existingUnit) {
          // Si ya existe, usar esa unidad y actualizar el mapeo
          idMappings.units.set(mongoUnit._id.toString(), existingUnit.id);
          stats.units.migrated++;
          
          if (counter % 10 === 0 || counter === mongoUnits.length) {
            logger.info(`Progreso unidades: ${counter}/${mongoUnits.length}`);
          }
          
          continue;
        }
        
        // Crear unidad en PostgreSQL
        const unit = await prisma.unit.create({
          data: {
            tenantId,
            operatorName: mongoUnit.operatorName,
            unitNumber: mongoUnit.unitNumber,
            buttonId: mongoUnit.buttonId,
            isActive: mongoUnit.isActive,
            // Preservar fechas originales
            createdAt: mongoUnit.createdAt,
            updatedAt: mongoUnit.updatedAt
          }
        });
        
        // Guardar mapeo de IDs
        idMappings.units.set(mongoUnit._id.toString(), unit.id);
        stats.units.migrated++;
        
        if (counter % 10 === 0 || counter === mongoUnits.length) {
          logger.info(`Progreso unidades: ${counter}/${mongoUnits.length}`);
        }
        
      } catch (error) {
        stats.units.errors++;
        errors.units.push({
          unitId: mongoUnit._id.toString(),
          operatorName: mongoUnit.operatorName,
          unitNumber: mongoUnit.unitNumber,
          error: error.message
        });
        logger.error(`Error al migrar unidad ${mongoUnit.operatorName} (${mongoUnit.unitNumber}): ${error.message}`);
      }
    }
    
    logger.info(`Unidades migradas: ${stats.units.migrated}/${stats.units.total}`);
    
  } catch (error) {
    logger.error(`Error general migrando unidades: ${error.message}`);
    throw error;
  }
}

/**
 * Migra las cargas de combustible de MongoDB a PostgreSQL
 */
async function migrateFuels(tenantId) {
  try {
    logger.info('Migrando cargas de combustible...');
    
    // Obtener todas las cargas de MongoDB
    const mongoFuels = await Fuel.find({}).populate('unitId');
    stats.fuels.total = mongoFuels.length;
    logger.info(`Total de cargas a migrar: ${mongoFuels.length}`);
    
    // Contador de progreso
    let counter = 0;
    
    // Migrar cada carga
    for (const mongoFuel of mongoFuels) {
      try {
        counter++;
        
        // Verificar que tengamos la unidad mapeada
        const oldUnitId = mongoFuel.unitId._id.toString();
        const newUnitId = idMappings.units.get(oldUnitId);
        
        if (!newUnitId) {
          throw new Error(`No se encontró mapeo para la unidad con ID: ${oldUnitId}`);
        }
        
        // Obtener valores para campos desnormalizados
        const operatorName = mongoFuel.operatorName || mongoFuel.unitId.operatorName;
        const unitNumber = mongoFuel.unitNumber || mongoFuel.unitId.unitNumber;
        
        // Crear datos para la carga
        const fuelData = {
          tenantId,
          unitId: newUnitId,
          liters: mongoFuel.liters,
          amount: mongoFuel.amount,
          fuelType: mongoFuel.fuelType.toUpperCase() === 'GAS' ? 'GAS' : 'GASOLINA',
          saleNumber: mongoFuel.saleNumber,
          paymentStatus: mongoFuel.paymentStatus === 'pagada' ? 'PAGADA' : 'NO_PAGADA',
          paymentDate: mongoFuel.paymentDate,
          ticketPhoto: mongoFuel.ticketPhoto,
          recordDate: mongoFuel.recordDate,
          operatorName,
          unitNumber,
          createdAt: mongoFuel.createdAt,
          updatedAt: mongoFuel.updatedAt
        };
        
        // Crear carga en PostgreSQL
        await prisma.fuel.create({
          data: fuelData
        });
        
        stats.fuels.migrated++;
        
        if (counter % 50 === 0 || counter === mongoFuels.length) {
          logger.info(`Progreso cargas: ${counter}/${mongoFuels.length}`);
        }
        
      } catch (error) {
        stats.fuels.errors++;
        errors.fuels.push({
          fuelId: mongoFuel._id.toString(),
          unitId: mongoFuel.unitId?._id?.toString(),
          error: error.message
        });
        logger.error(`Error al migrar carga ${mongoFuel._id}: ${error.message}`);
      }
    }
    
    logger.info(`Cargas migradas: ${stats.fuels.migrated}/${stats.fuels.total}`);
    
  } catch (error) {
    logger.error(`Error general migrando cargas: ${error.message}`);
    throw error;
  }
}

/**
 * Formatea una fecha para usar en nombres de archivo
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada (AAAAMMDD_HHMMSS)
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Ejecutar migración
migrateData()
  .then(() => {
    logger.info('Proceso de migración finalizado');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Error en proceso principal: ${error.message}`);
    process.exit(1);
  });
