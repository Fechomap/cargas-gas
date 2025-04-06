// config/environment.js
import { logger } from '../src/utils/logger.js';

// Validación de variables de entorno requeridas
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'MONGODB_URI',
  'MONGODB_DB_NAME'
];

// Verificar variables de entorno requeridas
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Variable de entorno requerida no está definida: ${envVar}`);
    process.exit(1);
  }
}

// Exportar variables de entorno para uso en la aplicación
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};