// src/api/telegram.api.js
import { Telegraf, session } from 'telegraf';
import { logger } from '../utils/logger.js';

/**
 * Inicializa el bot de Telegram con la configuración proporcionada
 * @param {Object} config - Configuración del bot
 * @returns {Telegraf} - Instancia del bot
 */
export function initializeBot(config) {
  try {
    const bot = new Telegraf(config.token, config.options);
    
    // Habilitar el manejo de sesiones para usuarios
    bot.use(session());
    
    // Configuración básica de manejo de errores
    bot.catch((err, ctx) => {
      logger.error(`Error en el bot para ${ctx.updateType}:`, err);
      // Enviar mensaje de error al usuario
      ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.');
    });
    
    return bot;
  } catch (error) {
    logger.error('Error al inicializar el bot de Telegram:', error);
    throw error;
  }
}