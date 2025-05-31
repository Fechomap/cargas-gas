// src/commands/fuel/date-handling.command.js
import { fuelController } from '../../controllers/index.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para el manejo de fechas en registros de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupDateHandlingCommands(bot) {
  // Acción cuando el usuario confirma que la carga es de hoy
  bot.action('fuel_date_today', async (ctx) => {
    try {
      if (isInState(ctx, 'fuel_date_confirm')) {
        logger.info(`Usuario ${ctx.from.id} confirmó que la carga es de hoy`);
        await ctx.answerCbQuery('Fecha actual confirmada');
        await ctx.reply('✅ Se usará la fecha actual para la carga.');
        
        // Completar el registro con la fecha actual
        await fuelController.completeFuelRegistration(ctx);
      }
    } catch (error) {
      logger.error(`Error en confirmación de fecha actual: ${error.message}`);
      await ctx.answerCbQuery('Error en la operación');
      await fuelController.completeFuelRegistration(ctx);
    }
  });

  // Acción cuando el usuario indica que la carga es de otra fecha
  bot.action('fuel_date_other', async (ctx) => {
    try {
      if (isInState(ctx, 'fuel_date_confirm')) {
        logger.info(`Usuario ${ctx.from.id} indicó que la carga es de otra fecha`);
        await fuelController.showDateOptions(ctx);
      }
    } catch (error) {
      logger.error(`Error al mostrar opciones de fecha: ${error.message}`);
      await ctx.answerCbQuery('Error al mostrar opciones');
      await fuelController.completeFuelRegistration(ctx);
    }
  });

  // Acción para seleccionar fecha personalizada
  bot.action('fuel_date_custom', async (ctx) => {
    try {
      if (isInState(ctx, 'fuel_date_select')) {
        logger.info(`Usuario ${ctx.from.id} solicitó ingresar fecha personalizada`);
        await fuelController.requestCustomDate(ctx);
      }
    } catch (error) {
      logger.error(`Error al solicitar fecha personalizada: ${error.message}`);
      await ctx.answerCbQuery('Error en la operación');
      await fuelController.completeFuelRegistration(ctx);
    }
  });

  // Acción para cancelar el cambio de fecha (mantener fecha actual)
  bot.action('fuel_date_cancel', async (ctx) => {
    try {
      if (isInState(ctx, 'fuel_date_select')) {
        logger.info(`Usuario ${ctx.from.id} canceló cambio de fecha`);
        await ctx.answerCbQuery('Se mantendrá la fecha actual');
        await ctx.reply('✅ Se mantendrá la fecha actual para la carga.');
        
        await fuelController.completeFuelRegistration(ctx);
      }
    } catch (error) {
      logger.error(`Error al cancelar cambio de fecha: ${error.message}`);
      await ctx.answerCbQuery('Error en la operación');
      await fuelController.completeFuelRegistration(ctx);
    }
  });

  // Manejador para entrada de fecha personalizada
  bot.on('text', async (ctx, next) => {
    if (isInState(ctx, 'fuel_date_custom_input')) {
      await fuelController.handleCustomDateInput(ctx);
      return;
    }
    
    // Continuar con el siguiente middleware si no estamos en estado de entrada de fecha
    return next();
  });

  // Manejadores para las fechas recientes (1-7 días atrás)
  for (let i = 1; i <= 7; i++) {
    bot.action(`fuel_date_day_${i}`, async (ctx) => {
      try {
        if (isInState(ctx, 'fuel_date_select')) {
          logger.info(`Usuario ${ctx.from.id} seleccionó fecha de hace ${i} días`);
          await fuelController.updateRecordDate(ctx, i);
        }
      } catch (error) {
        logger.error(`Error al seleccionar fecha de hace ${i} días: ${error.message}`);
        await ctx.answerCbQuery('Error en la operación');
        await fuelController.completeFuelRegistration(ctx);
      }
    });
  }
}
