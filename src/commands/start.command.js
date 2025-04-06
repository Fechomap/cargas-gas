// src/commands/start.command.js
import { logger } from '../utils/logger.js';
import { getMainKeyboard } from '../views/keyboards.js';
import { getWelcomeMessage } from '../views/messages.js';

/**
 * Configura el comando /start del bot
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupStartCommand(bot) {
  bot.start(async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} inició el bot`);
      
      // Inicializar estado de sesión si no existe
      if (!ctx.session) {
        ctx.session = { state: 'idle', data: {} };
      }
      
      // Enviar mensaje de bienvenida con teclado principal
      await ctx.reply(getWelcomeMessage(ctx.from.first_name), {
        parse_mode: 'Markdown',
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      logger.error(`Error en comando start: ${error.message}`);
      ctx.reply('Ocurrió un error al iniciar el bot. Por favor, intenta nuevamente.');
    }
  });
}