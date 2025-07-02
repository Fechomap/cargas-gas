// src/commands/unidades/listado.command.js
import { Markup } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { unitController } from '../../controllers/unit/index.js';

/**
 * Configura los comandos para listar y gestionar unidades existentes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosListado(bot) {
  // Manejar botón de ver unidades
  bot.action('show_units', async (ctx) => {
    try {
      await ctx.answerCbQuery('Cargando unidades');
      logger.info(`Usuario ${ctx.from.id} solicitó ver unidades`);

      // Llamar al controlador para mostrar unidades
      await unitController.showRegisteredUnits(ctx);
    } catch (error) {
      logger.error(`Error al mostrar unidades: ${error.message}`);
      await ctx.reply('Ocurrió un error al cargar las unidades.');

      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    }
  });

  // Manejar selección de una unidad específica
  bot.action(/^view_unit_(.+)$/, async (ctx) => {
    try {
      const unitId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} seleccionó unidad ${unitId}`);

      await ctx.answerCbQuery('Cargando información de unidad');
      await unitController.showUnitDetails(ctx, unitId);
    } catch (error) {
      logger.error(`Error al mostrar detalles de unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar detalles');
      await ctx.reply('Ocurrió un error al mostrar los detalles de la unidad.');

      // Volver a la lista de unidades como fallback
      await unitController.showRegisteredUnits(ctx);
    }
  });

  // Manejar acción de editar unidad
  bot.action(/^edit_unit_(.+)$/, async (ctx) => {
    try {
      const unitId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} solicitó editar unidad ${unitId}`);

      await ctx.answerCbQuery('Iniciando edición de unidad');
      await unitController.startUnitEdit(ctx, unitId);
    } catch (error) {
      logger.error(`Error al iniciar edición de unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al iniciar edición');
      await ctx.reply('Ocurrió un error al iniciar la edición de la unidad.');
    }
  });

  // Manejar acción de eliminar unidad
  bot.action(/^delete_unit_(.+)$/, async (ctx) => {
    try {
      const unitId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} solicitó eliminar unidad ${unitId}`);

      await ctx.answerCbQuery('Solicitando confirmación de eliminación');

      // Solicitar confirmación para eliminar
      await ctx.reply(
        '⚠️ *¿Estás seguro de eliminar esta unidad?*\n\n' +
        'Esta acción no se puede deshacer y eliminará todo el historial de cargas asociado.',
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Sí, eliminar', `confirm_delete_unit_${unitId}`),
              Markup.button.callback('❌ No, cancelar', 'show_units')
            ]
          ])
        }
      );
    } catch (error) {
      logger.error(`Error al solicitar eliminación de unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al procesar solicitud');
      await ctx.reply('Ocurrió un error al procesar la solicitud.');
    }
  });

  // Manejar confirmación de eliminación de unidad
  bot.action(/^confirm_delete_unit_(.+)$/, async (ctx) => {
    try {
      const unitId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} confirmó eliminar unidad ${unitId}`);

      await ctx.answerCbQuery('Procesando eliminación');

      // Ejecutar la eliminación
      const result = await unitController.deleteUnit(ctx, unitId);

      if (result.success) {
        await ctx.reply('✅ Unidad eliminada correctamente.');
      } else {
        await ctx.reply(`❌ No se pudo eliminar la unidad: ${result.error}`);
      }

      // Mostrar unidades actualizadas
      await unitController.showRegisteredUnits(ctx);
    } catch (error) {
      logger.error(`Error al eliminar unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al eliminar');
      await ctx.reply('Ocurrió un error al eliminar la unidad.');
    }
  });

  // Volver a la lista de unidades
  bot.action('back_to_units', async (ctx) => {
    try {
      await ctx.answerCbQuery('Volviendo a la lista de unidades');
      await unitController.showRegisteredUnits(ctx);
    } catch (error) {
      logger.error(`Error al volver a lista de unidades: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar unidades');
      await ctx.reply('Ocurrió un error al cargar las unidades.');
    }
  });
}
