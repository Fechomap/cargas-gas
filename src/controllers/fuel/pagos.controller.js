// src/controllers/fuel/pagos.controller.js
import { Markup } from 'telegraf';
import { FuelService } from '../../services/fuel.adapter.service.js';
import { updateConversationState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';
import { getMainKeyboard } from '../../views/keyboards.js';

// Crear instancia del servicio de combustible
const fuelService = new FuelService();

/**
 * Controlador para gestionar pagos y búsqueda de notas de combustible
 */
export class PagosController {
  /**
   * Marca una carga como pagada
   * @param {string} fuelId - ID de la carga a marcar
   * @returns {Promise<Object>} - Carga actualizada
   */
  async markFuelAsPaid(fuelId) {
    try {
      logger.info(`Marcando carga ${fuelId} como pagada`);
      const updatedFuel = await fuelService.markAsPaid(fuelId);
      logger.info(`Carga ${fuelId} marcada como pagada correctamente`);
      return updatedFuel;
    } catch (error) {
      logger.error(`Error al marcar carga como pagada: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Marca todas las cargas no pagadas como pagadas
   * @returns {Promise<number>} - Cantidad de cargas actualizadas
   */
  async markAllUnpaidAsPaid() {
    try {
      logger.info('Marcando todas las cargas no pagadas como pagadas');
      const count = await fuelService.markAllUnpaidAsPaid();
      logger.info(`${count} cargas marcadas como pagadas`);
      return count;
    } catch (error) {
      logger.error(`Error al marcar todas como pagadas: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Inicia el flujo de búsqueda de nota por número de venta
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startNoteSearch(ctx) {
    try {
      logger.info(`Usuario ${ctx.from.id} inició búsqueda de nota`);
      
      // Actualizar estado de conversación
      await updateConversationState(ctx, 'search_note_input', {});
      
      // Mostrar instrucciones y solicitar número de nota
      await ctx.reply(
        '🔍 *Búsqueda de nota para pago*\n\n' +
        'Por favor, ingresa el número de nota o venta que deseas marcar como pagada:',
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            Markup.button.callback('❌ Cancelar', 'cancel_note_search')
          ])
        }
      );
    } catch (error) {
      logger.error(`Error al iniciar búsqueda de nota: ${error.message}`);
      await ctx.reply('Ocurrió un error al iniciar la búsqueda. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Procesa la entrada del número de venta para búsqueda
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleNoteSearchInput(ctx) {
    try {
      const searchQuery = ctx.message.text.trim();
      
      if (!searchQuery) {
        return await ctx.reply('Por favor, ingresa un número de nota válido.');
      }
      
      logger.info(`Buscando nota con query: ${searchQuery}`);
      
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto para búsqueda de nota');
        return await ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      // Buscar la nota por número de venta con tenant
      const fuel = await fuelService.findBySaleNumber(searchQuery, ctx.tenant.id);
      
      if (!fuel) {
        await ctx.reply(`⚠️ No se encontró ninguna nota con el número: ${searchQuery}`);
        await ctx.reply('Por favor, verifica el número e intenta nuevamente o cancela la operación.');
        return;
      }
      
      // Guardar el ID de la nota en la sesión (usando el campo id para PostgreSQL)
      ctx.session.data.noteId = fuel.id;
      logger.info(`Carga encontrada con ID: ${fuel.id}, estado: ${fuel.paymentStatus}`);
      
      // Verificar si la nota ya está pagada (en PostgreSQL es 'PAGADA' en mayúsculas)
      if (fuel.paymentStatus === 'PAGADA') {
        await ctx.reply(`⚠️ Nota #${searchQuery} ya está marcada como pagada.`);
        await ctx.reply(`Fecha de pago: ${fuel.paymentDate ? this.formatDate(fuel.paymentDate) : 'No registrada'}`);
        
        // Preguntar si desea buscar otra nota
        await ctx.reply('¿Deseas buscar otra nota?',
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Buscar otra', 'search_note_for_payment')],
            [Markup.button.callback('❌ Cancelar', 'cancel_note_search')]
          ])
        );
        return;
      }
      
      // Actualizar estado de conversación
      await updateConversationState(ctx, 'search_note_confirm', {
        noteId: fuel.id,
        saleNumber: fuel.saleNumber
      });
      
      logger.info(`Estado actualizado con noteId: ${fuel.id} para saleNumber: ${fuel.saleNumber}`);
      
      // Registrar en log que vamos a mostrar los botones para nota no pagada
      logger.info(`Mostrando resumen y botones para nota no pagada #${fuel.saleNumber}`);
      
      // Mostrar resumen de la nota
      const noteDetails = `
*💳 STATUS: ${fuel.paymentStatus.toUpperCase()}*

*📝 Nota encontrada*
*Número:* ${fuel.saleNumber}
*Operador:* ${fuel.operatorName}
*Unidad:* ${fuel.unitNumber}
*Tipo de combustible:* ${fuel.fuelType}
*Fecha:* ${this.formatDate(fuel.recordDate)}
*Monto:* *$${fuel.amount.toFixed(2)}*
*Litros:* ${fuel.liters.toFixed(2)}`;
      
      // Usar formato explícito para asegurar que los botones se muestren
      await ctx.reply(noteDetails, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ PAGAR', callback_data: 'mark_note_as_paid' }],
            [{ text: '❌ CANCELAR', callback_data: 'cancel_note_search' }]
          ]
        }
      });
    } catch (error) {
      logger.error(`Error en búsqueda de nota: ${error.message}`);
      await ctx.reply('Ocurrió un error durante la búsqueda. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Marca la nota seleccionada como pagada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleMarkAsPaid(ctx) {
    try {
      if (!ctx.session?.data?.noteId) {
        await ctx.answerCbQuery('Error: No se encontró referencia a la nota');
        await ctx.reply('Ocurrió un error. No se encontró referencia a la nota seleccionada.');
        return;
      }
      
      const noteId = ctx.session.data.noteId;
      
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto para marcar nota como pagada');
        await ctx.answerCbQuery('Error: No se pudo identificar el grupo');
        await ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
        return;
      }
      
      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      logger.info(`Marcando como pagada la nota con ID ${noteId} para tenant: ${tenantId}`);
      
      // Marcar como pagada pasando el tenantId
      const updatedFuel = await fuelService.markAsPaid(noteId, tenantId);
      
      await ctx.answerCbQuery('Nota marcada como pagada');
      
      // Confirmar actualización
      await ctx.reply(`✅ Nota #${updatedFuel.saleNumber} marcada como pagada correctamente.`);
      await ctx.reply(`Fecha de pago: ${this.formatDate(updatedFuel.paymentDate)}`);
      
      // Limpiar estado
      await updateConversationState(ctx, 'idle', {});
      
      // Preguntar si desea buscar otra nota
      await ctx.reply('¿Deseas buscar otra nota?',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Buscar otra', 'search_note_for_payment')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al marcar nota como pagada: ${error.message}`);
      await ctx.answerCbQuery('Error al marcar como pagada');
      await ctx.reply('Ocurrió un error al marcar la nota como pagada. Por favor, intenta nuevamente.');
      
      // Volver al menú principal
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  }
  
  /**
   * Marca una nota como pagada (alias para compatibilidad)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async markNoteAsPaid(ctx) {
    return this.handleMarkAsPaid(ctx);
  }
  
  /**
   * Cancela la operación de búsqueda de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async cancelNoteSearch(ctx) {
    try {
      await ctx.answerCbQuery('Operación cancelada');
      await ctx.reply('No se califico como PAGADA.');
      
      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});
      
      // Mostrar menú principal usando formato explícito
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🆕 Registrar unidad', callback_data: 'register_unit' }],
            [{ text: '⛽ Registrar carga', callback_data: 'register_fuel_start' }],
            [{ text: '💰 Consultar saldo', callback_data: 'check_balance' }],
            [{ text: '🔍 Buscar nota para pago', callback_data: 'search_note_for_payment' }],
            [{ text: '📊 Generar reporte', callback_data: 'generate_report' }],
            [{ text: '❓ Ayuda', callback_data: 'show_help' }]
          ]
        }
      });
      
      // Registrar en log que se ha mostrado el menú principal
      logger.info(`Menú principal mostrado después de cancelar búsqueda para usuario ${ctx.from.id}`);
      
    } catch (error) {
      logger.error(`Error al cancelar búsqueda de nota: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, vuelve al menú principal.');
      
      // Intento alternativo con botones básicos como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Volver al menú principal', callback_data: 'main_menu' }]
          ]
        }
      });
    }
  }
  
  /**
   * Formatea una fecha a un string legible
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha formateada
   */
  formatDate(date) {
    if (!date) return 'No especificada';
    return new Date(date).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
