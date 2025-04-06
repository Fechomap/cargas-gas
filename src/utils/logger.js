// src/utils/logger.js
import { createLogger, format, transports } from 'winston';

// Obtener nivel de log desde variables de entorno o usar 'info' por defecto
const level = process.env.LOG_LEVEL || 'info';

// Crear formato personalizado
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
  format.printf(info => {
    return `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}${info.stack ? '\n' + info.stack : ''}`;
  })
);

// Crear logger
export const logger = createLogger({
  level,
  format: customFormat,
  defaultMeta: { service: 'telegram-gas-bot' },
  transports: [
    // Registrar en consola
    new transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      )
    }),
    // Registrar errores en archivo
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Registrar todos los logs en archivo
    new transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Si no estamos en producción, también mostrar logs en consola
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized at debug level');
}

// Capturar excepciones no manejadas
logger.exceptions.handle(
  new transports.File({ filename: 'logs/exceptions.log' })
);

// Capturar rechazos de promesas no manejados
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

export function logError(message, error, methodName = '') {
  const prefix = methodName ? `[${methodName}] ` : '';
  logger.error(`${prefix}${message}`);
  if (error && error.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
}