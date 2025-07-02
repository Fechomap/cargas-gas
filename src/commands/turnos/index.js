// src/commands/turnos/index.js
import { TurnoController } from '../../controllers/turno.controller.js';
import { logger } from '../../utils/logger.js';

/**
 * Configurar comandos relacionados con turnos
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupTurnosCommands(bot) {
  const turnoController = new TurnoController();

  // Comando /turnos para acceder al menú principal
  bot.command('turnos', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} accedió al comando /turnos`);

      // Verificar que el usuario tenga tenant (esté registrado)
      if (!ctx.tenant) {
        await ctx.reply('❌ No tienes acceso a esta funcionalidad. Contacta al administrador.');
        return;
      }

      await turnoController.showTurnosMenu(ctx);

    } catch (error) {
      logger.error(`Error en comando /turnos: ${error.message}`);
      await ctx.reply('Error al acceder al menú de turnos. Por favor, intenta nuevamente.');
    }
  });

  // Callbacks para botones del menú de turnos
  bot.action('turno_inicio_dia', async (ctx) => {
    try {
      await ctx.answerCbQuery('Iniciando proceso de inicio de turno');
      await turnoController.startInicioTurno(ctx);
    } catch (error) {
      logger.error(`Error en turno_inicio_dia: ${error.message}`);
      await ctx.answerCbQuery('Error al iniciar proceso');
      await ctx.reply('Error al iniciar el proceso de inicio de turno.');
    }
  });

  bot.action('turno_fin_dia', async (ctx) => {
    try {
      await ctx.answerCbQuery('Iniciando proceso de fin de turno');
      await turnoController.startFinTurno(ctx);
    } catch (error) {
      logger.error(`Error en turno_fin_dia: ${error.message}`);
      await ctx.answerCbQuery('Error al iniciar proceso');
      await ctx.reply('Error al iniciar el proceso de fin de turno.');
    }
  });

  bot.action('turno_ver_registros', async (ctx) => {
    try {
      await ctx.answerCbQuery('Consultando registros del día');
      await turnoController.showTodayLogs(ctx);
    } catch (error) {
      logger.error(`Error en turno_ver_registros: ${error.message}`);
      await ctx.answerCbQuery('Error al consultar registros');
      await ctx.reply('Error al consultar los registros del día.');
    }
  });

  // Callbacks para acciones durante el proceso de turnos
  bot.action('turno_omit_unit', async (ctx) => {
    try {
      await turnoController.omitCurrentUnit(ctx);
    } catch (error) {
      logger.error(`Error en turno_omit_unit: ${error.message}`);
      await ctx.answerCbQuery('Error al omitir unidad');
      await ctx.reply('Error al omitir la unidad. Continuando...');
    }
  });

  bot.action('turno_cancel_process', async (ctx) => {
    try {
      await turnoController.cancelTurnoProcess(ctx);
    } catch (error) {
      logger.error(`Error en turno_cancel_process: ${error.message}`);
      await ctx.answerCbQuery('Error al cancelar proceso');
      await ctx.reply('Error al cancelar el proceso.');
    }
  });

  // Handler para entrada de kilómetros durante turnos
  bot.on('text', async (ctx, next) => {
    try {
      // Solo procesar si estamos en estado de captura de kilómetros de turno
      if (ctx.session?.state === 'turno_capturing_kilometers') {
        await turnoController.handleTurnoKilometersEntry(ctx);
        return; // No pasar al siguiente middleware
      }

      // Pasar al siguiente middleware si no es nuestro estado
      return next();
    } catch (error) {
      logger.error(`Error en handler de texto para turnos: ${error.message}`);
      await ctx.reply('Error al procesar entrada. Continuando...');
      return next();
    }
  });

  logger.info('Comandos de turnos configurados correctamente');
}