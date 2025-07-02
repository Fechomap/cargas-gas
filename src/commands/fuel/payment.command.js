// src/commands/fuel/payment.command.js
import { fuelController } from '../../controllers/index.js';
import { isInState } from '../../state/conversation.js';
import { getMainKeyboard } from '../../views/keyboards.js';
import { logger } from '../../utils/logger.js';
import { storageService } from '../../services/storage.service.js';

/**
 * Configura los comandos para el manejo de pagos de cargas de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupPaymentCommands(bot) {
  // Acción para buscar nota para pago
  bot.action('search_note_for_payment', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} inició búsqueda de nota para pago mediante botón`);
      await ctx.answerCbQuery('Iniciando búsqueda de nota...');
      await fuelController.startNoteSearch(ctx);
    } catch (error) {
      logger.error(`Error en acción search_note_for_payment: ${error.message}`, error);
      await ctx.answerCbQuery('Error al iniciar búsqueda');
      await ctx.reply('Ocurrió un error al iniciar la búsqueda de nota. Por favor, intenta nuevamente.');

      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });

  // Acción para cancelar la búsqueda de nota
  bot.action('cancel_note_search', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} canceló la búsqueda de nota`);
      await ctx.answerCbQuery('Búsqueda cancelada');
      await fuelController.cancelNoteSearch(ctx);
    } catch (error) {
      logger.error(`Error al cancelar búsqueda de nota: ${error.message}`, error);
      await ctx.answerCbQuery('Error al cancelar');

      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });

  // Acción para marcar una nota como pagada
  bot.action('mark_note_as_paid', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} solicitó marcar nota como pagada`);
      await ctx.answerCbQuery('Procesando pago...');
      logger.info('Llamando a fuelController.markAsPaid()');
      await fuelController.markAsPaid(ctx);
    } catch (error) {
      logger.error(`Error al marcar nota como pagada: ${error.message}`, error);
      await ctx.answerCbQuery('Error al procesar pago');
      await ctx.reply('Ocurrió un error al marcar la nota como pagada. Por favor, intenta nuevamente.');

      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });

  // Acción para descargar archivo asociado a una nota
  bot.action(/^download_file_(.+)$/, async (ctx) => {
    try {
      const fileId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} solicitó descarga del archivo: ${fileId}`);

      await ctx.answerCbQuery('Generando enlace de descarga...');

      // Generar URL firmada temporal (válida por 1 hora)
      const signedUrl = await storageService.getSignedUrl(fileId, 3600);

      // Enviar documento usando la URL firmada
      await ctx.replyWithDocument(signedUrl, {
        caption: '📄 Documento de respaldo de la carga de combustible'
      });

      logger.info(`Archivo ${fileId} enviado exitosamente al usuario ${ctx.from.id}`);

    } catch (error) {
      logger.error(`Error al descargar archivo: ${error.message}`, error);
      await ctx.answerCbQuery('❌ Error al descargar archivo');
      await ctx.reply('❌ Error al descargar el documento. El archivo puede no estar disponible o haber expirado.');
    }
  });

  // Manejar la entrada de texto para búsqueda de notas
  bot.on('text', async (ctx, next) => {
    // NUEVO ESTADO: Manejo de entrada de búsqueda de nota
    if (isInState(ctx, 'search_note_input')) {
      await fuelController.handleNoteSearchInput(ctx);
      return;
    }

    // Continuar con el siguiente middleware si no estamos en estado de búsqueda
    return next();
  });
}
