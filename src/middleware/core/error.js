// src/middleware/core/error.js
import { logger } from '../../utils/logger.js';

/**
 * Middleware para manejo centralizado de errores
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 */
export function setupErrorMiddleware(bot) {
  // Middleware para capturar todos los errores no manejados
  bot.catch((err, ctx) => {
    logger.error('Error no capturado en bot:', {
      error: err.message,
      stack: err.stack,
      update: ctx.update,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      tenantId: ctx.tenant?.id
    });

    // Responder al usuario solo si es posible
    if (ctx.telegram && ctx.chat) {
      ctx.reply('Ha ocurrido un error. El equipo técnico ha sido notificado.')
        .catch(() => {
          logger.warn('No se pudo enviar mensaje de error al usuario');
        });
    }
  });

  // Middleware para errores en la cadena de middlewares
  bot.use(async (ctx, next) => {
    try {
      // Continuar con el siguiente middleware
      await next();
    } catch (error) {
      // Registrar el error con detalles
      logger.error(`Error en cadena de middleware: ${error.message}`, {
        error: error.stack,
        ctx: {
          updateType: ctx.updateType,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id,
          tenantId: ctx.tenant?.id
        }
      });

      // Solo enviar respuesta si no ha sido enviada ya
      if (!ctx.responseProcessed) {
        ctx.responseProcessed = true;
        await ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.');
      }

      // No llamamos a next() para evitar propagar el error
    }
  });
}

/**
 * Middleware para envolver funciones con manejo de errores
 * Útil para manejadores de comandos
 * @param {Function} handler - Función a envolver con manejo de errores
 * @returns {Function} Función con manejo de errores
 */
export function withErrorHandler(handler) {
  return async (ctx, next) => {
    try {
      return await handler(ctx, next);
    } catch (error) {
      logger.error(`Error en handler: ${error.message}`, {
        error: error.stack,
        handler: handler.name,
        ctx: {
          updateType: ctx.updateType,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id
        }
      });

      // Enviar mensaje de error genérico
      await ctx.reply('Lo sentimos, ocurrió un error al procesar tu solicitud.');

      // No propagamos el error
      return;
    }
  };
}
