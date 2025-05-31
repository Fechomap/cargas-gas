// src/commands/unidades/desactivacion.command.js
import { Markup } from 'telegraf';
import { unitController } from '../../controllers/unit/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos relacionados con la desactivación de unidades
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosDesactivacion(bot) {
  // Comando para mostrar menú de gestión de unidades
  bot.action('manage_units', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('Selecciona una opción para gestionar las unidades:',
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver unidades', 'show_units')],
          [Markup.button.callback('➕ Registrar unidad', 'register_unit')],
          [Markup.button.callback('🗑 Desactivar unidad', 'deactivate_unit_menu')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al mostrar menú de gestión de unidades: ${error.message}`);
      await ctx.reply('Error al mostrar el menú. Por favor, intenta de nuevo más tarde.');
    }
  });

  // Comando para mostrar lista de unidades para desactivar
  bot.action('deactivate_unit_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await unitController.showUnitsForDeactivation(ctx);
    } catch (error) {
      logger.error(`Error al mostrar unidades para desactivar: ${error.message}`);
      await ctx.reply('Error al cargar las unidades. Por favor, intenta de nuevo más tarde.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'deactivate_unit_menu')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });

  // Manejador para confirmar desactivación de una unidad
  bot.action(/^deactivate_unit_(.+)$/, async (ctx) => {
    try {
      await unitController.deactivateUnit(ctx);
    } catch (error) {
      logger.error(`Error al desactivar unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al desactivar la unidad');
      await ctx.reply(`❌ Error al desactivar la unidad: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'deactivate_unit_menu')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });
}
