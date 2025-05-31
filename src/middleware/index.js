// src/middleware/index.js
import { setupErrorMiddleware } from './core/error.js';
import { setupSessionMiddleware } from './core/session.js';
import { setupLoggingMiddleware } from './core/logging.js';
import { setupTenantValidationMiddleware } from './tenant/validation.js';
import { setupTenantSettingsMiddleware } from './tenant/settings.js';
import { setupAccessControlMiddleware } from './security/access.js';
import { setupGroupRestrictionMiddleware } from './security/group.js';
import { setupAdminCheckMiddleware } from './security/admin-check.js';
import { setupDiagnosticMiddleware } from './debug/diagnostic.js';
import { logger } from '../utils/logger.js';

/**
 * Configuración centralizada de middleware
 * Aplica todos los middlewares en el orden correcto
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 * @param {Object} options - Opciones de configuración
 */
export function setupMiddleware(bot, options = {}) {
  const {
    enableDiagnostic = true,
    enableLogging = true,
    enableGroupRestriction = true,
    enableTenantValidation = true,
    enableTenantSettings = true,
  } = options;

  logger.info('Iniciando configuración de middlewares');

  // 1. Middleware de errores (siempre debe ser el primero)
  setupErrorMiddleware(bot);
  
  // 2. Middleware de diagnóstico (opcional)
  if (enableDiagnostic) {
    setupDiagnosticMiddleware(bot);
  }
  
  // 3. Middleware de logging (opcional)
  if (enableLogging) {
    setupLoggingMiddleware(bot);
  }
  
  // 4. Middleware de sesión (siempre necesario)
  setupSessionMiddleware(bot);
  
  // 5. Middleware de restricción de grupo (opcional)
  if (enableGroupRestriction) {
    setupGroupRestrictionMiddleware(bot);
  }
  
  // 6. Middleware de validación de tenant (opcional)
  if (enableTenantValidation) {
    setupTenantValidationMiddleware(bot);
  }
  
  // 7. Middleware de configuración de tenant (opcional)
  if (enableTenantSettings) {
    setupTenantSettingsMiddleware(bot);
  }
  
  // 8. Middleware de control de acceso (siempre necesario)
  setupAccessControlMiddleware(bot);
  
  // 9. Middleware de verificación de administradores de grupo
  setupAdminCheckMiddleware(bot);
  
  logger.info('Middlewares configurados correctamente');
}

/**
 * Configuración específica para modo de depuración
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupDebugMiddleware(bot) {
  // Configuración específica para depuración
  // Este middleware solo se activa en entornos de desarrollo
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Activando middlewares de depuración');
    setupDiagnosticMiddleware(bot, { verbose: true });
  }
}
