// src/commands/fuel/desactivacion.command.js
import { Markup } from 'telegraf';
import { fuelController } from '../../controllers/fuel/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos relacionados con la desactivación de registros de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupFuelDeactivationCommands(bot) {
  // Comando para iniciar búsqueda de registros para desactivar
  bot.action('search_fuel_records', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await fuelController.showSearchForm(ctx);
    } catch (error) {
      logger.error(`Error al iniciar búsqueda de registros: ${error.message}`);
      await ctx.reply('Error al iniciar la búsqueda. Por favor, intenta de nuevo más tarde.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });

  // Manejador para procesar la entrada de texto (número de nota)
  bot.on('text', async (ctx, next) => {
    // Verificar si estamos en espera de confirmación (estado nuevo)
    const isWaitingForConfirmation =
      ctx.session?.fuelSearch?.step === 'waiting_for_deactivation_confirmation' ||
      ctx.session?.state === 'waiting_for_deactivation_confirmation';

    // Si está esperando confirmación, mostrar mensaje de usar botones y no procesar el texto
    if (isWaitingForConfirmation) {
      logger.info(`Usuario ${ctx.from.id} intentó responder con texto en lugar de usar botones: ${ctx.message.text}`);
      await ctx.reply('Por favor, usa los botones de ✅ Sí o ❌ No para confirmar o cancelar la desactivación.');
      return; // No continuar con otros manejadores
    }

    // Verificar si estamos en modo de búsqueda
    const isInSearchMode =
      ctx.session?.fuelSearch?.step === 'waiting_for_sale_number' ||
      ctx.session?.state === 'search_fuel_for_deactivation';

    if (isInSearchMode) {
      logger.info(`Usuario ${ctx.from.id} ingresó búsqueda para desactivación: ${ctx.message.text}`);
      await fuelController.searchRecords(ctx);
    } else {
      // Si no estamos en ninguno de los estados del flujo, continuar con el siguiente manejador
      await next();
    }
  });

  // Manejador para solicitar confirmación antes de desactivar (paso 1)
  bot.action(/deactivate_fuel_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      // Extraer el ID del registro
      const callbackData = ctx.callbackQuery.data;
      const fuelId = callbackData.replace('deactivate_fuel_', '');

      // Obtener el registro para mostrar detalles
      if (!ctx.tenant) {
        throw new Error('No se encontró tenant en el contexto');
      }

      // Mostrar confirmación y resumen antes de desactivar
      await fuelController.showDeactivationConfirmation(ctx, fuelId);
    } catch (error) {
      logger.error(`Error al preparar confirmación de desactivación: ${error.message}`);
      await ctx.reply(`❌ Error al preparar la desactivación: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });

  // Manejador para confirmar desactivación (paso 2)
  bot.action(/confirm_deactivate_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Procesando desactivación...');
      await fuelController.deactivateFuel(ctx, true); // true indica que ya fue confirmado
    } catch (error) {
      logger.error(`Error al desactivar registro: ${error.message}`);
      await ctx.reply(`❌ Error al desactivar el registro: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });

  // Manejador para cancelar desactivación
  bot.action(/cancel_deactivate_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Operación cancelada');

      // Restablecer el estado de la sesión
      if (ctx.session) {
        ctx.session.state = 'idle';
        if (ctx.session.fuelSearch) {
          ctx.session.fuelSearch.step = null;
        }
        logger.info(`Cancelación: Restableciendo estado a idle (Usuario: ${ctx.from.id})`);
      }

      await ctx.reply('✖️ Operación cancelada. El registro NO ha sido desactivado.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Buscar otro registro', 'search_fuel_records')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al cancelar desactivación: ${error.message}`);
      await ctx.reply('Error al procesar la solicitud.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });
}
