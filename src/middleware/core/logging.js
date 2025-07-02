// src/middleware/core/logging.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para logging estructurado
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupLoggingMiddleware(bot) {
  bot.use(async (ctx, next) => {
    const start = Date.now();
    const updateId = ctx.update?.update_id || 'desconocido';

    // Registro de inicio de solicitud
    logger.debug(`Solicitud iniciada [${updateId}] - Tipo: ${ctx.updateType || 'desconocido'}`, {
      updateType: ctx.updateType,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      tenantId: ctx.tenant?.id
    });

    try {
      // Continuar con el siguiente middleware y esperar su finalización
      await next();

      // Calcular tiempo de respuesta
      const ms = Date.now() - start;

      // Registro de finalización exitosa
      logger.debug(`Solicitud completada [${updateId}] en ${ms}ms`, {
        updateType: ctx.updateType,
        processingTime: ms,
        success: true
      });
    } catch (error) {
      // Calcular tiempo hasta el error
      const ms = Date.now() - start;

      // Registro de error (pero NO llamamos a next() aquí)
      logger.error(`Solicitud fallida [${updateId}] después de ${ms}ms: ${error.message}`, {
        updateType: ctx.updateType,
        processingTime: ms,
        error: error.stack,
        success: false
      });

      // Re-lanzar el error para que lo maneje el middleware de errores
      throw error;
    }
  });
}

/**
 * Middleware específico para logging detallado de mensajes y callbacks
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupDetailedLoggingMiddleware(bot) {
  bot.use(async (ctx, next) => {
    // Registrar detalles específicos según el tipo de actualización
    if (ctx.updateType === 'callback_query') {
      logger.info(`CALLBACK: Usuario ${ctx.from?.id || 'desconocido'} - Datos: ${ctx.callbackQuery.data}`, {
        type: 'callback',
        data: ctx.callbackQuery.data,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
        tenantId: ctx.tenant?.id,
        messageId: ctx.callbackQuery.message?.message_id
      });
    } else if (ctx.updateType === 'message') {
      const text = ctx.message?.text || 'sin texto';
      logger.info(`MENSAJE: Usuario ${ctx.from?.id || 'desconocido'} - Contenido: ${text}`, {
        type: 'message',
        text: text,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
        tenantId: ctx.tenant?.id,
        messageId: ctx.message?.message_id
      });
    }

    // Continuar con el siguiente middleware
    return next();
  });
}
