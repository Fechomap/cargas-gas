// config/environment.js
import { logger } from '../src/utils/logger.js';

// PostgreSQL es la única base de datos utilizada
const DB_MODE = 'postgresql';

// Validación de variables de entorno requeridas
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN'
];



// Variables requeridas para PostgreSQL
const postgreRequiredVars = [
  'DATABASE_URL'
];

// Combinar todas las variables requeridas
const allRequiredVars = [...requiredEnvVars, ...postgreRequiredVars];

// Verificar variables de entorno requeridas
for (const envVar of allRequiredVars) {
  if (!process.env[envVar]) {
    logger.error(`Variable de entorno requerida no está definida: ${envVar}`);
    process.exit(1);
  }
}

// Exportar variables de entorno para uso en la aplicación
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_MODE: DB_MODE,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};