// src/commands/start.command.js
import { logger } from '../utils/logger.js';
import { getMainKeyboard } from '../views/keyboards.js';
import { getWelcomeMessage } from '../views/messages.js';
import { Markup } from 'telegraf';

export function setupStartCommand(bot) {
  // Comando /start
  bot.start(async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} inició el bot`);
      
      // Inicializar estado de sesión si no existe
      if (!ctx.session) {
        ctx.session = { state: 'idle', data: {} };
      }
      
      // Enviar mensaje de bienvenida
      await ctx.reply(getWelcomeMessage(ctx.from.first_name), {
        parse_mode: 'Markdown'
      });
      
      // CORRECCIÓN: Usar directamente el formato de Markup.inlineKeyboard
      await ctx.reply('Selecciona una opción:', Markup.inlineKeyboard([
        [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
        [Markup.button.callback('👁️ Ver unidades', 'show_units')],
        [Markup.button.callback('💰 Consultar saldo pendiente', 'check_balance')],
        [Markup.button.callback('📊 Generar reporte', 'generate_report')],
        [Markup.button.callback('❓ Ayuda', 'show_help')]
      ]));
      
    } catch (error) {
      logger.error(`Error en comando start: ${error.message}`, error);
      ctx.reply('Ocurrió un error al iniciar el bot. Por favor, intenta nuevamente.');
      
      // Intento alternativo con botones básicos en caso de error
      try {
        await ctx.reply('Menú alternativo:', Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar', 'register_unit')],
          [Markup.button.callback('💰 Saldo', 'check_balance')],
          [Markup.button.callback('📊 Reporte', 'generate_report')]
        ]));
      } catch (buttonError) {
        logger.error(`Error al mostrar botones alternativos: ${buttonError.message}`);
      }
    }
  });
}