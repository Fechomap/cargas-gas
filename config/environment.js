// config/environment.js
import { logger } from '../src/utils/logger.js';

// Determinar el modo de base de datos desde variables de entorno
const DB_MODE = process.env.DB_MODE || 'dual'; // Valores posibles: 'mongodb', 'postgresql', 'dual'

// Validación de variables de entorno requeridas
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN'
];

// Variables requeridas solo si usamos MongoDB
const mongoRequiredVars = DB_MODE !== 'postgresql' ? [
  'MONGODB_URI',
  'MONGODB_DB_NAME'
] : [];

// Variables requeridas solo si usamos PostgreSQL
const postgreRequiredVars = DB_MODE !== 'mongodb' ? [
  'DATABASE_URL'
] : [];

// Combinar todas las variables requeridas según el modo
const allRequiredVars = [...requiredEnvVars, ...mongoRequiredVars, ...postgreRequiredVars];

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
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_MODE: DB_MODE,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};