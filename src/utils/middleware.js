// src/utils/middleware.js
import { logger } from './logger.js';

/**
 * Configura los middlewares del bot
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupMiddleware(bot) {
  // Añadir diagnóstico
  setupDiagnosticMiddleware(bot);
  
  // Middleware de logging
  bot.use(async (ctx, next) => {
    try {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      logger.debug(`${ctx.updateType} procesado en ${ms}ms`);
    } catch (error) {
      logger.error(`Error en middleware principal: ${error.message}`, error);
      await next();
    }
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
// Añadir este middleware para diagnóstico de flujo
export function setupDiagnosticMiddleware(bot) {
  // Middleware para registrar todas las actualizaciones
  bot.use(async (ctx, next) => {
    try {
      // Registrar tipo de actualización
      const updateType = ctx.updateType || 'desconocido';
      const userId = ctx.from ? ctx.from.id : 'desconocido';
      
      if (updateType === 'callback_query') {
        logger.info(`CALLBACK: Usuario ${userId} - Datos: ${ctx.callbackQuery.data}`);
      } else if (updateType === 'message') {
        const text = ctx.message.text || 'sin texto';
        logger.info(`MENSAJE: Usuario ${userId} - Contenido: ${text}`);
      }
      
      await next();
    } catch (error) {
      logger.error(`Error en middleware de diagnóstico: ${error.message}`, error);
      await next();
    }
  });
}