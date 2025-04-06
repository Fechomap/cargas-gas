// src/controllers/fuel.controller.js
import { Markup } from 'telegraf';
import { fuelService } from '../services/fuel.service.js';
import { unitController } from './unit.controller.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { storageService } from '../services/storage.service.js';

/**
 * Controlador para gestionar cargas de combustible
 */
class FuelController {
  /**
   * Inicia el flujo de captura de carga de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} unitButtonId - ID del botón de la unidad
   */
  async startFuelEntry(ctx, unitButtonId) {
    try {
      // Obtener la unidad seleccionada
      const unit = await unitController.getUnitByButtonId(unitButtonId);
      
      if (!unit) {
        return await ctx.reply('Unidad no encontrada. Por favor, selecciona otra unidad.');
      }
      
      // Guardar información de la unidad en la sesión
      await updateConversationState(ctx, 'fuel_entry_liters', {
        unitId: unit._id,
        operatorName: unit.operatorName,
        unitNumber: unit.unitNumber,
        unitButtonId: unitButtonId
      });
      
      // Solicitar los litros cargados
      await ctx.reply(`Capturando carga para: ${unit.operatorName} - ${unit.unitNumber}`);
      await ctx.reply('Por favor, ingresa la cantidad de litros cargados:');
    } catch (error) {
      logger.error(`Error al iniciar captura de carga: ${error.message}`);
      await ctx.reply('Error al iniciar la captura de carga. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Maneja la entrada de litros en el flujo de captura
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleLitersEntry(ctx) {
    try {
      const liters = parseFloat(ctx.message.text.replace(',', '.'));
      
      if (isNaN(liters) || liters <= 0) {
        return await ctx.reply('Por favor, ingresa un número válido mayor a cero.');
      }
      
      // Guardar litros en la sesión
      ctx.session.data.liters = liters;
      await updateConversationState(ctx, 'fuel_entry_amount');
      
      // Solicitar monto en pesos
      await ctx.reply('Ingresa el monto total en pesos:');
    } catch (error) {
      logger.error(`Error en entrada de litros: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente los litros.');
    }
  }
  
  /**
   * Maneja la entrada del monto en el flujo de captura
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleAmountEntry(ctx) {
    try {
      // Limpiar posibles caracteres no numéricos (como $ o ,)
      const cleanText = ctx.message.text.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleanText);
      
      if (isNaN(amount) || amount <= 0) {
        return await ctx.reply('Por favor, ingresa un monto válido mayor a cero.');
      }
      
      // Guardar monto en la sesión
      ctx.session.data.amount = amount;
      await updateConversationState(ctx, 'fuel_entry_type');
      
      // Solicitar tipo de combustible
      await ctx.reply('Selecciona el tipo de combustible:', 
        Markup.inlineKeyboard([
          Markup.button.callback('Gas', 'fuel_type_gas'),
          Markup.button.callback('Gasolina', 'fuel_type_gasolina')
        ])
      );
    } catch (error) {
      logger.error(`Error en entrada de monto: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente el monto.');
    }
  }
  
  /**
   * Procesa la selección del tipo de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelType - Tipo de combustible seleccionado
   */
  async handleFuelTypeSelection(ctx, fuelType) {
    try {
      // Guardar tipo de combustible en la sesión
      ctx.session.data.fuelType = fuelType;
      await updateConversationState(ctx, 'fuel_entry_photo');
      
      await ctx.answerCbQuery(`Tipo de combustible: ${fuelType}`);
      
      // Solicitar foto del ticket
      await ctx.reply('Por favor, envía una foto del ticket (opcional, puedes enviar cualquier mensaje para omitir):');
    } catch (error) {
      logger.error(`Error en selección de combustible: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, selecciona nuevamente el tipo de combustible.');
    }
  }
  
  /**
   * Procesa la foto del ticket o su omisión
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleTicketPhoto(ctx) {
    try {
      let photoUrl = null;
      
      // Verificar si se envió una foto
      if (ctx.message.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        photoUrl = await storageService.savePhotoFromTelegram(ctx, fileId);
        await ctx.reply('Foto del ticket recibida');
      } else {
        await ctx.reply('Foto omitida');
      }
      
      // Guardar URL de la foto en la sesión
      ctx.session.data.ticketPhoto = photoUrl;
      await updateConversationState(ctx, 'fuel_entry_payment');
      
      // Solicitar estatus de pago
      await ctx.reply('¿Cuál es el estatus de pago?', 
        Markup.inlineKeyboard([
          Markup.button.callback('Pagada', 'payment_status_pagada'),
          Markup.button.callback('No pagada', 'payment_status_no_pagada')
        ])
      );
    } catch (error) {
      logger.error(`Error en manejo de foto: ${error.message}`);
      await ctx.reply('Ocurrió un error con la foto. Continuaremos sin foto del ticket.');
      
      // Continuar sin foto
      ctx.session.data.ticketPhoto = null;
      await updateConversationState(ctx, 'fuel_entry_payment');
      
      await ctx.reply('¿Cuál es el estatus de pago?', 
        Markup.inlineKeyboard([
          Markup.button.callback('Pagada', 'payment_status_pagada'),
          Markup.button.callback('No pagada', 'payment_status_no_pagada')
        ])
      );
    }
  }
  
  /**
   * Procesa la selección del estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} paymentStatus - Estatus de pago seleccionado
   */
  async handlePaymentStatusSelection(ctx, paymentStatus) {
    try {
      // Guardar estatus de pago en la sesión
      ctx.session.data.paymentStatus = paymentStatus;
      await updateConversationState(ctx, 'fuel_entry_confirm');
      
      await ctx.answerCbQuery(`Estatus de pago: ${paymentStatus}`);
      
      // Mostrar resumen y solicitar confirmación
      const summary = `
📝 *Resumen de la carga*
👤 Operador: ${ctx.session.data.operatorName}
🚚 Unidad: ${ctx.session.data.unitNumber}
⛽ Tipo: ${ctx.session.data.fuelType}
🔢 Litros: ${ctx.session.data.liters}
💰 Monto: $${ctx.session.data.amount.toFixed(2)}
💳 Estatus: ${ctx.session.data.paymentStatus}
🧾 Ticket: ${ctx.session.data.ticketPhoto ? 'Incluido' : 'No incluido'}
      `;
      
      await ctx.reply(summary, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback('✅ Guardar', 'fuel_confirm_save'),
          Markup.button.callback('❌ Cancelar', 'fuel_confirm_cancel')
        ])
      });
    } catch (error) {
      logger.error(`Error en selección de estatus: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, selecciona nuevamente el estatus de pago.');
    }
  }
  
  /**
   * Guarda la carga de combustible en la base de datos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async saveFuelEntry(ctx) {
    try {
      // Crear objeto de carga desde los datos de la sesión
      const fuelData = {
        unitId: ctx.session.data.unitId,
        liters: ctx.session.data.liters,
        amount: ctx.session.data.amount,
        fuelType: ctx.session.data.fuelType,
        paymentStatus: ctx.session.data.paymentStatus,
        ticketPhoto: ctx.session.data.ticketPhoto,
        operatorName: ctx.session.data.operatorName,
        unitNumber: ctx.session.data.unitNumber
      };
      
      // Guardar en la base de datos
      const savedFuel = await fuelService.createFuelEntry(fuelData);
      
      await ctx.answerCbQuery('Carga guardada correctamente');
      await ctx.reply(`✅ Carga registrada correctamente con ID: ${savedFuel._id}`);
      
      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});
      
      // Mostrar menú principal o permitir otra captura
      await ctx.reply('¿Qué deseas hacer ahora?', 
        Markup.inlineKeyboard([
          Markup.button.callback('Registrar otra carga', ctx.session.data.unitButtonId),
          Markup.button.callback('Volver al menú principal', 'main_menu')
        ])
      );
    } catch (error) {
      logger.error(`Error al guardar carga: ${error.message}`);
      await ctx.answerCbQuery('Error al guardar');
      await ctx.reply('Ocurrió un error al guardar la carga. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Obtiene el saldo total pendiente (cargas no pagadas)
   * @returns {Promise<number>} - Monto total pendiente
   */
  async getTotalPendingBalance() {
    try {
      return await fuelService.getTotalUnpaidAmount();
    } catch (error) {
      logger.error(`Error al obtener saldo pendiente: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Marca una carga como pagada
   * @param {string} fuelId - ID de la carga a marcar
   * @returns {Promise<Object>} - Carga actualizada
   */
  async markFuelAsPaid(fuelId) {
    try {
      return await fuelService.markAsPaid(fuelId);
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
      return await fuelService.markAllUnpaidAsPaid();
    } catch (error) {
      logger.error(`Error al marcar todas las cargas como pagadas: ${error.message}`);
      throw error;
    }
  }
}

export const fuelController = new FuelController();