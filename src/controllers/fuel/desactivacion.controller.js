// src/controllers/fuel/desactivacion.controller.js
import { Markup } from 'telegraf';
import { FuelService } from '../../services/fuel.adapter.service.js';
import { logger } from '../../utils/logger.js';
import { AuditService, AuditActions } from '../../services/audit.service.js';

/**
 * Controlador para manejar la desactivación de registros de combustible
 */
export class DesactivacionController {
  // No necesitamos instanciar el servicio porque usamos sus métodos estáticos
  constructor() {
    // this.fuelService se mantiene para métodos de instancia como searchNotesBySaleNumber
    this.fuelService = new FuelService();
  }
  /**
   * Muestra el formulario para buscar registros por número de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showSearchForm(ctx) {
    try {
      // Actualizar el estado de la conversación usando el formato estándar
      if (!ctx.session) ctx.session = {};
      ctx.session.state = 'search_fuel_for_deactivation';
      ctx.session.data = {};

      // También mantener fuelSearch para compatibilidad con código existente
      ctx.session.fuelSearch = {
        step: 'waiting_for_sale_number'
      };

      logger.info(`Cambio de estado: ${ctx.session?.previousState || 'idle'} -> ${ctx.session.state} (Usuario: ${ctx.from.id})`);

      await ctx.reply('Por favor, ingresa el número de nota para buscar el registro de combustible que deseas desactivar:',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Cancelar y volver al menú', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al mostrar formulario de búsqueda: ${error.message}`);
      await ctx.reply('Error al iniciar la búsqueda. Por favor, intenta de nuevo más tarde.');
    }
  }

  /**
   * Busca registros por número de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async searchRecords(ctx) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }

      const saleNumber = ctx.message.text.trim();
      const tenantId = ctx.tenant.id;

      // Buscar registros por número de nota
      const records = await this.fuelService.searchNotesBySaleNumber(saleNumber, tenantId);

      if (!records || records.length === 0) {
        await ctx.reply(`No se encontraron registros con el número de nota "${saleNumber}".`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Buscar otro registro', 'search_fuel_records')],
            [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
          ])
        );
        return;
      }

      // Crear botones para los registros encontrados
      const buttons = records.map(record => {
        const date = new Date(record.recordDate).toLocaleDateString('es-MX');
        const label = `${date} | ${record.operatorName} | ${record.amount} pesos`;
        return [Markup.button.callback(label, `deactivate_fuel_${record.id}`)];
      });

      // Añadir botones de navegación
      buttons.push([Markup.button.callback('🔄 Buscar otro registro', 'search_fuel_records')]);
      buttons.push([Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]);

      await ctx.reply(`Se encontraron ${records.length} registro(s). Selecciona el que deseas desactivar:`,
        Markup.inlineKeyboard(buttons)
      );

      // Limpiar el estado de búsqueda
      delete ctx.session.fuelSearch;

    } catch (error) {
      logger.error(`Error al buscar registros: ${error.message}`);
      await ctx.reply('Error al buscar registros. Por favor, intenta de nuevo más tarde.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    }
  }

  /**
   * Muestra confirmación antes de desactivar, con resumen detallado y advertencia
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {String} fuelId - ID del registro de combustible
   */
  async showDeactivationConfirmation(ctx, fuelId) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }

      const tenantId = ctx.tenant.id;

      // Obtener detalles completos del registro
      const fuelRecord = await FuelService.getFuelById(fuelId, tenantId);

      if (!fuelRecord) {
        await ctx.reply('El registro no existe o ya ha sido desactivado.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Buscar otro registro', 'search_fuel_records')],
            [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
          ])
        );
        return;
      }

      // Formatear fecha para mostrar
      const date = new Date(fuelRecord.recordDate).toLocaleDateString('es-MX');
      const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(fuelRecord.amount);

      // Crear mensaje con todos los detalles del registro (texto plano, sin formato especial)
      let detailMessage = '⚠️ ADVERTENCIA DE DESACTIVACIÓN ⚠️\n\n';
      detailMessage += 'Estás a punto de desactivar el siguiente registro:\n\n';
      detailMessage += `📅 Fecha: ${date}\n`;
      detailMessage += `🛢️ Operador: ${fuelRecord.operatorName}\n`;
      detailMessage += `🔢 Número de nota: ${fuelRecord.saleNumber}\n`;
      detailMessage += `💰 Monto: ${formattedAmount}\n`;
      detailMessage += `⛽ Litros: ${fuelRecord.liters}\n`;

      // Solo mostrar precio unitario si está definido
      if (fuelRecord.unitPrice) {
        detailMessage += `📈 Precio unitario: ${fuelRecord.unitPrice}\n`;
      }

      if (fuelRecord.comments) {
        detailMessage += `💬 Comentarios: ${fuelRecord.comments}\n`;
      }

      detailMessage += '\n❌ IMPORTANTE: Esta acción no se puede deshacer. El registro será desactivado y ya no aparecerá en las consultas ni reportes.';

      // Cambiar el estado de la sesión para que no siga en modo búsqueda
      if (ctx.session) {
        // Actualizar ambos formatos de estado para mayor compatibilidad
        ctx.session.state = 'waiting_for_deactivation_confirmation';
        if (ctx.session.fuelSearch) {
          ctx.session.fuelSearch.step = 'waiting_for_deactivation_confirmation';
        } else {
          ctx.session.fuelSearch = { step: 'waiting_for_deactivation_confirmation' };
        }
        logger.info(`Cambio de estado: ${ctx.session.state} (Usuario: ${ctx.from.id})`);
      }

      // Primero enviamos el mensaje con toda la información
      await ctx.telegram.sendMessage(ctx.chat.id, detailMessage);

      // Luego enviamos un mensaje separado con SOLO los botones para asegurar que aparezcan
      await ctx.telegram.sendMessage(ctx.chat.id, '\u00bfEstás seguro de querer desactivar este registro?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Sí, desactivar', callback_data: `confirm_deactivate_${fuelId}` }],
            [{ text: '❌ No, cancelar', callback_data: `cancel_deactivate_${fuelId}` }]
          ]
        }
      });

      // Mensaje de ayuda adicional para orientar al usuario
      await ctx.telegram.sendMessage(ctx.chat.id, '_Por favor, usa los botones de arriba para confirmar o cancelar la desactivación._', {
        parse_mode: 'Markdown'
      });

      // Log para debug
      logger.info(`Botones de confirmación generados para ${fuelId}`);
      logger.info(`Callback confirm: confirm_deactivate_${fuelId}`);
      logger.info(`Callback cancel: cancel_deactivate_${fuelId}`);

    } catch (error) {
      logger.error(`Error al mostrar confirmación: ${error.message}`);
      await ctx.reply(`Error al preparar la confirmación: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    }
  }

  /**
   * Desactiva un registro de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Boolean} isConfirmed - Indica si ya fue confirmado por el usuario
   */
  async deactivateFuel(ctx, isConfirmed = false) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }

      // Restablecer el estado de la sesión
      if (ctx.session) {
        ctx.session.state = 'idle';
        if (ctx.session.fuelSearch) {
          ctx.session.fuelSearch.step = null;
        }
        logger.info(`Restableciendo estado a idle (Usuario: ${ctx.from.id})`);
      }

      // Extraer el ID del registro de la data del callback
      const callbackData = ctx.callbackQuery.data;
      // Ajustar la extracción del ID según el tipo de callback
      const fuelId = isConfirmed
        ? callbackData.replace('confirm_deactivate_', '')
        : callbackData.replace('deactivate_fuel_', '');

      const tenantId = ctx.tenant.id;

      // Si no está confirmado y no estamos en el segundo paso, mostrar confirmación
      if (!isConfirmed) {
        // Esta llamada es redundante porque ya la hacemos en otro lugar, pero la dejamos para compatibilidad
        return this.showDeactivationConfirmation(ctx, fuelId);
      }

      // Obtener el registro antes de desactivarlo (para mostrar información)
      const fuelRecord = await FuelService.getFuelById(fuelId, tenantId);

      if (!fuelRecord) {
        await ctx.answerCbQuery('Registro no encontrado');
        return ctx.reply('El registro no existe o ya ha sido desactivado.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Buscar otro registro', 'search_fuel_records')],
            [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
          ])
        );
      }

      // Formatear datos para el mensaje
      const date = new Date(fuelRecord.recordDate).toLocaleDateString('es-MX');
      const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(fuelRecord.amount);

      // Desactivar el registro
      await FuelService.deactivateFuel(fuelId, tenantId);

      // 🔍 AUDITORÍA: Registrar desactivación
      await AuditService.logDeletion({
        entity: 'Fuel',
        entityId: fuelId,
        deletedRecord: fuelRecord,
        ctx,
        isHardDelete: false
      });

      // Crear mensaje detallado de confirmación
      let successMessage = '✅ *REGISTRO DESACTIVADO* ✅\n\n';
      successMessage += 'El siguiente registro ha sido desactivado exitosamente:\n\n';
      successMessage += `📅 *Fecha*: ${date}\n`;
      successMessage += `🛢️ *Operador*: ${fuelRecord.operatorName}\n`;
      successMessage += `🔢 *Número de nota*: ${fuelRecord.saleNumber}\n`;
      successMessage += `💰 *Monto*: ${formattedAmount}\n`;
      successMessage += `⛽ *Litros*: ${fuelRecord.liters}\n`;

      // Mostrar mensaje de éxito con formato
      await ctx.answerCbQuery('Registro desactivado correctamente');
      await ctx.reply(successMessage, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Desactivar otro registro', 'search_fuel_records')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    } catch (error) {
      logger.error(`Error al desactivar registro: ${error.message}`);
      await ctx.answerCbQuery('Error al desactivar registro');
      await ctx.reply(`❌ Error al desactivar el registro: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'search_fuel_records')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    }
  }
}
