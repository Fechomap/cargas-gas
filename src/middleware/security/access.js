// src/middleware/security/access.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para control de acceso basado en roles y permisos
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupAccessControlMiddleware(bot) {
  bot.use(async (ctx, next) => {
    try {
      // Si estamos en modo admin o no hay tenant, continuar sin verificación adicional
      if (ctx.isAdminMode || !ctx.tenant) {
        return next();
      }

      // Obtener información del comando o acción
      const messageText = ctx.message?.text || '';
      const isCommand = messageText.startsWith('/');

      // Lista de comandos administrativos a nivel de tenant
      const adminCommands = ['/configurar', '/eliminar', '/reset', '/bloquear', '/desbloquear'];

      // Verificar si es un comando administrativo a nivel de tenant
      if (isCommand && adminCommands.some(cmd => messageText.startsWith(cmd))) {
        // Verificar si el usuario es administrador del tenant
        const isAdminAllowed = await isTenantAdmin(ctx.from?.id, ctx.tenant?.id);

        if (!isAdminAllowed) {
          logger.warn(`Intento de acceso administrativo denegado: Usuario ${ctx.from?.id} en tenant ${ctx.tenant?.id}`);
          await ctx.reply('No tienes permisos de administrador para ejecutar este comando.');
          return; // No continuar
        }

        logger.info(`Comando administrativo de tenant autorizado: ${messageText}`);
      }

      // Verificar permisos basados en características habilitadas
      if (ctx.tenantSettings && isCommand) {
        const commandFeatureMap = {
          '/reporte': 'reportGeneration',
          '/exportar': 'exportData',
          '/operadores': 'multipleOperators',
          '/notificar': 'notifications'
        };

        // Encontrar la característica asociada al comando
        const feature = Object.entries(commandFeatureMap)
          .find(([cmd, _]) => messageText.startsWith(cmd))?.[1];

        // Si el comando requiere una característica específica y está deshabilitada, bloquear
        if (feature && ctx.tenantSettings.features && ctx.tenantSettings.features[feature] === false) {
          logger.warn(`Intento de usar característica deshabilitada: ${feature} en tenant ${ctx.tenant?.id}`);
          await ctx.reply('Esta característica no está habilitada para tu empresa. Contacta al administrador para activarla.');
          return; // No continuar
        }
      }

      // Si llegamos aquí, el acceso está permitido
      return next();
    } catch (error) {
      logger.error('Error en middleware de control de acceso:', {
        error: error.message,
        stack: error.stack,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        tenantId: ctx.tenant?.id
      });

      // En caso de error, permitir el acceso (es más seguro permitir que bloquear en caso de error)
      return next();
    }
  });
}

/**
 * Verifica si un usuario es administrador de un tenant específico
 * @param {string} userId - ID del usuario
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<boolean>} - True si es admin del tenant, false en caso contrario
 */
async function isTenantAdmin(userId, tenantId) {
  if (!userId || !tenantId) return false;

  try {
    // Obtener lista de administradores del tenant desde el servicio
    // Este es un placeholder, deberías implementar la lógica real en TenantService
    const admins = await getTenantAdmins(tenantId);

    // Verificar si el usuario está en la lista
    return admins.includes(userId.toString());
  } catch (error) {
    logger.error(`Error al verificar administrador de tenant: ${error.message}`, {
      userId,
      tenantId,
      error: error.stack
    });

    // En caso de error, denegar acceso por seguridad
    return false;
  }
}

/**
 * Obtiene la lista de administradores de un tenant
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<string[]>} - Array con IDs de administradores
 */
async function getTenantAdmins(tenantId) {
  // Placeholder - Esta función debería obtener los administradores de la base de datos
  // Por ahora, devolvemos una lista vacía
  return [];

  // Implementación real debería ser algo como:
  // return await TenantService.getTenantAdmins(tenantId);
}
