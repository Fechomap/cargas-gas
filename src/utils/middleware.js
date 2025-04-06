// src/utils/middleware.js
import { logger } from './logger.js';

/**
 * Configura los middlewares del bot
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupMiddleware(bot) {
  // Middleware de logging
  bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.debug(`${ctx.updateType} procesado en ${ms}ms`);
  });

  // Middleware para inicializar sesión si no existe
  bot.use((ctx, next) => {
    if (!ctx.session) {
      ctx.session = { state: 'idle', data: {} };
    }
    return next();
  });

  // Middleware para capturar errores
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      logger.error(`Error en middleware: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.');
    }
  });
}