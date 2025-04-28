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

/**
 * Configura restricción para solo permitir el bot en un grupo específico
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupGroupRestriction(bot) {
  // IMPORTANTE: Reemplaza este ID con la ID real de tu grupo
  const ALLOWED_GROUP_IDS = [-1002411620798, -4527368480]; // ID de tu grupo
  
  // Middleware para restringir acceso SOLO al grupo específico
  bot.use((ctx, next) => {
    // Registrar información del chat para depuración
    if (ctx.chat) {
      logger.info(`Chat info - ID: ${ctx.chat.id}, Tipo: ${ctx.chat.type}, Título: ${ctx.chat.title || 'N/A'}`);
    }
    
    // Si no hay chat o no es el grupo autorizado, ignorar
    if (!ctx.chat || !ALLOWED_GROUP_IDS.includes(ctx.chat.id)) {
      logger.warn(`Acceso denegado - ID: ${ctx.chat?.id || 'desconocido'}, Tipo: ${ctx.chat?.type || 'desconocido'}`);
      return; // Bloquear silenciosamente, no responder al usuario
    }
    
    // Si llegamos aquí, es el grupo autorizado
    return next();
  });
}