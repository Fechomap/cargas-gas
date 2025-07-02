// src/middleware/adapter.js
// Adaptador para migración gradual al nuevo sistema de middlewares
import { setupMiddleware } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Configura la aplicación para usar el nuevo sistema de middleware
 * manteniendo compatibilidad con el código anterior
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function migrateToNewMiddleware(bot) {
  logger.info('Migrando a nuevo sistema de middleware...');

  // Usar el nuevo sistema de middleware con todas las opciones habilitadas
  setupMiddleware(bot, {
    enableDiagnostic: true,
    enableLogging: true,
    enableGroupRestriction: true,
    enableTenantValidation: true,
    enableTenantSettings: true
  });

  logger.info('Migración a nuevo sistema de middleware completada');
}

/**
 * Función de compatibilidad para el código antiguo
 * Redirige a la nueva implementación
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupMiddleware_LEGACY(bot) {
  logger.warn('Llamada a setupMiddleware obsoleta, utilizando nuevo sistema');
  migrateToNewMiddleware(bot);
}

/**
 * Función de compatibilidad para el código antiguo
 * Redirige a la nueva implementación
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupDiagnosticMiddleware_LEGACY(bot) {
  logger.warn('Llamada a setupDiagnosticMiddleware obsoleta, utilizando nuevo sistema');

  // Importar solo el middleware de diagnóstico
  const { setupDiagnosticMiddleware } = require('./debug/diagnostic.js');
  setupDiagnosticMiddleware(bot, { verbose: true });
}

/**
 * Función de compatibilidad para el código antiguo
 * Redirige a la nueva implementación
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupGroupRestriction_LEGACY(bot) {
  logger.warn('Llamada a setupGroupRestriction obsoleta, utilizando nuevo sistema');

  // Importar solo el middleware de restricción de grupo
  const { setupGroupRestrictionMiddleware } = require('./security/group.js');
  setupGroupRestrictionMiddleware(bot);
}

/**
 * Función de compatibilidad para middleware de tenant
 * @param {Context} ctx - Contexto de Telegraf
 * @param {Function} next - Función para continuar cadena de middleware
 */
export async function withTenant_LEGACY(ctx, next) {
  logger.warn('Uso directo de withTenant obsoleto, se recomienda usar el nuevo sistema');

  // Importar el middleware de tenant
  const { withTenant } = require('./tenant/validation.js');

  // Crear y ejecutar el middleware
  await withTenant()(ctx, next);
}

/**
 * Función de compatibilidad para middleware de configuración de tenant
 * @param {Context} ctx - Contexto de Telegraf
 * @param {Function} next - Función para continuar cadena de middleware
 */
export async function withTenantSettings_LEGACY(ctx, next) {
  logger.warn('Uso directo de withTenantSettings obsoleto, se recomienda usar el nuevo sistema');

  // Importar el middleware de configuración de tenant
  const { withTenantSettings } = require('./tenant/settings.js');

  // Crear y ejecutar el middleware
  await withTenantSettings()(ctx, next);
}
