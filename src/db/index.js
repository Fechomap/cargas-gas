// src/db/index.js - Único punto de entrada para acceso a la base de datos
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Instancia global de PrismaClient
export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' }
  ]
});

// Manejadores de eventos de logging
prisma.$on('error', (e) => {
  logger.error(`Error de Prisma: ${e.message}`, { error: e });
});

prisma.$on('warn', (e) => {
  logger.warn(`Advertencia de Prisma: ${e.message}`);
});

/**
 * Inicializa la conexión a la base de datos PostgreSQL
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  try {
    await prisma.$connect();
    logger.info('✅ Conexión a PostgreSQL establecida correctamente');

    // Registrar handlers para cerrar la conexión al finalizar
    setupDisconnectHandlers();

    return prisma;
  } catch (error) {
    logger.error('❌ Error al conectar a PostgreSQL:', error);
    throw error;
  }
}

/**
 * Configura los manejadores para cerrar la conexión de forma adecuada
 */
function setupDisconnectHandlers() {
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    logger.info('Conexión a PostgreSQL cerrada correctamente (SIGINT)');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    logger.info('Conexión a PostgreSQL cerrada correctamente (SIGTERM)');
    process.exit(0);
  });
}

// Exportamos un objeto de modelos para acceso conveniente (puede expandirse en el futuro)
export const db = {
  prisma,
  initializeDatabase
};

export default db;