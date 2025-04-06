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
      
      // Enviar mensaje de bienvenida con el teclado principal adjunto
      const { reply_markup } = getMainKeyboard(); // Obtener el objeto de teclado
      await ctx.reply(getWelcomeMessage(ctx.from.first_name), {
        parse_mode: 'Markdown',
        reply_markup: reply_markup // Adjuntar el teclado
      });
      
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

  // Acción para volver al menú principal
  bot.action('main_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery(); // Responde al callback para quitar el "loading"
      
      // Limpiar estado de conversación si es necesario (opcional, depende de la lógica)
      // await updateConversationState(ctx, 'idle', {}); 
      
      // Editar el mensaje anterior o enviar uno nuevo con el menú principal
      const { reply_markup } = getMainKeyboard();
      const messageText = getWelcomeMessage(ctx.from.first_name); // Reutilizar mensaje de bienvenida
      
      // Intentar editar el mensaje actual si es posible
      try {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          reply_markup: reply_markup
        });
      } catch (editError) {
        // Si no se puede editar (ej. mensaje muy viejo), enviar uno nuevo
        logger.warn(`No se pudo editar mensaje para main_menu: ${editError.message}`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          reply_markup: reply_markup
        });
      }
      
    } catch (error) {
      logger.error(`Error en acción main_menu: ${error.message}`, error);
      await ctx.reply('Ocurrió un error al volver al menú principal.');
      // Opcional: Mostrar menú de fallback
      const { reply_markup } = getMainKeyboard();
      await ctx.reply('Intenta seleccionar una opción:', { reply_markup });
    }
  });
}
