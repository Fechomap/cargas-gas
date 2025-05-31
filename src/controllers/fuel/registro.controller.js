// src/controllers/fuel/registro.controller.js
import { Markup } from 'telegraf';
import { FuelService } from '../../services/fuel.adapter.service.js';
import { unitController } from '../unit.controller.js';
import { updateConversationState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';
import { storageService } from '../../services/storage.service.js';
import { getMainKeyboard } from '../../views/keyboards.js';

// Crear instancia del servicio de combustible
const fuelService = new FuelService();

/**
 * Controlador para gestionar el registro de cargas de combustible
 */
export class RegistroController {
  /**
   * Inicia el flujo de captura de carga de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} unitButtonId - ID del botón de la unidad
   */
  async startFuelEntry(ctx, unitButtonId) {
    try {
      logger.info(`Iniciando captura de carga para unidad: ${unitButtonId}`);
      
      // Obtener la unidad seleccionada - pasar el contexto que contiene el tenant
      const unit = await unitController.getUnitByButtonId(ctx, unitButtonId);
      
      if (!unit) {
        logger.warn(`Unidad no encontrada: ${unitButtonId}`);
        return await ctx.reply('Unidad no encontrada. Por favor, selecciona otra unidad.');
      }
      
      logger.info(`Unidad encontrada: ${unit.operatorName} - ${unit.unitNumber}`);
      
      // Guardar información de la unidad en la sesión
      await updateConversationState(ctx, 'fuel_entry_liters', {
        unitId: unit.id,
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
      await ctx.answerCbQuery(`Seleccionado: ${fuelType}`);
      
      // Guardar tipo de combustible en la sesión
      ctx.session.data.fuelType = fuelType;
      await updateConversationState(ctx, 'fuel_entry_photo');
      
      // Solicitar foto del ticket
      await ctx.reply(
        'Por favor, envía una foto del ticket (opcional).\n' +
        'Puedes omitir este paso usando el botón "Omitir".',
        Markup.inlineKeyboard([
          Markup.button.callback('Omitir', 'skip_ticket_photo')
        ])
      );
    } catch (error) {
      logger.error(`Error en selección de combustible: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
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
      if (ctx.message?.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        photoUrl = await storageService.savePhotoFromTelegram(ctx, fileId);
        await ctx.reply('Foto del ticket recibida');
      } else {
        await ctx.reply('Foto omitida');
      }
      
      // Guardar URL de la foto en la sesión
      ctx.session.data.ticketPhoto = photoUrl;
      
      // Actualizar el estado para solicitar el número de venta
      await updateConversationState(ctx, 'fuel_entry_sale_number');
      
      // Solicitar el número de venta
      await ctx.reply('Por favor, ingresa el número de venta (1 a 6 dígitos impresos en la nota):');
    } catch (error) {
      logger.error(`Error en manejo de foto: ${error.message}`);
      await ctx.reply('Ocurrió un error con la foto. Continuaremos sin foto del ticket.');
      
      // Continuar sin foto
      ctx.session.data.ticketPhoto = null;
      
      // Actualizar estado para pedir número de venta
      await updateConversationState(ctx, 'fuel_entry_sale_number');
      
      // Solicitar el número de venta
      await ctx.reply('Por favor, ingresa el número de venta (1 a 6 dígitos impresos en la nota):');
    }
  }
  
  /**
   * Procesa la entrada del número de venta
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleSaleNumberEntry(ctx) {
    try {
      const saleNumber = ctx.message.text.trim();
      
      // Validar formato: 1-6 caracteres alfanuméricos con guiones
      const saleNumberRegex = /^[A-Za-z0-9-]{1,6}$/;
      if (!saleNumberRegex.test(saleNumber)) {
        return await ctx.reply('❌ Formato inválido. Ingresa un número de venta de 1 a 6 caracteres (números, letras o guiones).');
      }
      
      // Guardar número de venta en la sesión
      ctx.session.data.saleNumber = saleNumber;
      await updateConversationState(ctx, 'fuel_entry_payment');
      
      // Solicitar estatus de pago
      await ctx.reply('¿Cuál es el estatus de pago?', 
        Markup.inlineKeyboard([
          Markup.button.callback('Pagada', 'payment_status_pagada'),
          Markup.button.callback('No pagada', 'payment_status_no_pagada')
        ])
      );
    } catch (error) {
      logger.error(`Error en entrada de número de venta: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
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
      
      // Construir mensaje de resumen
      const summary = `
📝 *Resumen de la carga*
👤 Operador: ${ctx.session.data.operatorName}
🚚 Unidad: ${ctx.session.data.unitNumber}
⛽ Tipo: ${ctx.session.data.fuelType}
🔢 Litros: ${ctx.session.data.liters}
💰 Monto: $${ctx.session.data.amount.toFixed(2)}
🧾 Número de venta: ${ctx.session.data.saleNumber || 'No proporcionado'}
💳 Estatus: ${ctx.session.data.paymentStatus}
🧾 Ticket: ${ctx.session.data.ticketPhoto ? 'Incluido' : 'No incluido'}
      `;
      
      // Mostrar botones de confirmación
      await ctx.reply(summary, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Guardar', callback_data: 'fuel_confirm_save' }],
            [{ text: '❌ Cancelar', callback_data: 'fuel_confirm_cancel' }]
          ]
        }
      });
    } catch (error) {
      logger.error(`Error en selección de estatus: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Guarda la carga de combustible en la base de datos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async saveFuelEntry(ctx) {
    try {
      // Verificar si existen los datos necesarios
      if (!ctx.session || !ctx.session.data) {
        logger.error('Error: No hay datos en la sesión para guardar');
        await ctx.answerCbQuery('Error: Datos incompletos');
        await ctx.reply('Ocurrió un error. No hay datos para guardar. Por favor, intenta nuevamente.');
        return;
      }
      
      logger.info('Iniciando guardado de carga de combustible');
      logger.info(`Datos a guardar: ${JSON.stringify(ctx.session.data)}`);
      
      // Crear objeto de carga desde los datos de la sesión
      const fuelData = {
        unitId: ctx.session.data.unitId,
        liters: Number(ctx.session.data.liters) || 0,
        amount: Number(ctx.session.data.amount) || 0,
        // Convertir a mayúsculas para coincidir con el enum de Prisma
        fuelType: (ctx.session.data.fuelType || 'gas').toUpperCase(),
        saleNumber: ctx.session.data.saleNumber || null,
        // Convertir a formato NO_PAGADA/PAGADA para coincidir con el enum de Prisma
        paymentStatus: ctx.session.data.paymentStatus === 'pagada' ? 'PAGADA' : 'NO_PAGADA',
        ticketPhoto: ctx.session.data.ticketPhoto || null,
        operatorName: ctx.session.data.operatorName,
        unitNumber: ctx.session.data.unitNumber
      };
      
      logger.info(`Valores convertidos para Prisma - fuelType: ${fuelData.fuelType}, paymentStatus: ${fuelData.paymentStatus}`);
      
      logger.info(`Objeto fuelData creado: ${JSON.stringify(fuelData)}`);
      
      // Validar datos críticos
      const requiredFields = ['unitId', 'liters', 'amount', 'fuelType', 'paymentStatus'];
      const missingFields = requiredFields.filter(field => !fuelData[field]);
      
      if (missingFields.length > 0) {
        logger.error(`Error: Faltan campos requeridos: ${missingFields.join(', ')}`);
        await ctx.answerCbQuery('Error: Datos incompletos');
        await ctx.reply(`Faltan datos importantes: ${missingFields.join(', ')}. Por favor, intenta nuevamente.`);
        return;
      }
      
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        await ctx.answerCbQuery('Error: No se pudo identificar el grupo');
        await ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
        return;
      }
      
      logger.info(`Guardando carga de combustible: ${JSON.stringify(fuelData)}`);
      
      // Guardar en la base de datos con log detallado de cada paso
      logger.info('Llamando a fuelService.createFuelEntry() con tenantId');
      const savedFuel = await fuelService.createFuelEntry(fuelData, ctx.tenant.id);
      logger.info(`Carga guardada con ID: ${savedFuel.id}`);
      
      await ctx.answerCbQuery('Carga guardada correctamente');
      await ctx.reply(`✅ Carga registrada correctamente con ID: ${savedFuel.id}`);
      
      // Iniciar verificación de fecha de registro
      const fechaController = await import('./fecha.controller.js').then(m => new m.FechaController());
      await fechaController.checkRecordDate(ctx, savedFuel);
      return;
    } catch (error) {
      logger.error(`Error al guardar carga: ${error.message}`);
      await ctx.reply('Ocurrió un error al guardar la carga. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Finaliza el proceso de registro después de la verificación de fecha
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async completeFuelRegistration(ctx) {
    try {
      await updateConversationState(ctx, 'idle', {});
      await ctx.reply('¿Qué deseas hacer ahora?',
        Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar otra carga', ctx.session.data.unitButtonId || 'show_units')],
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al completar registro: ${error.message}`);
      await ctx.reply('¿Qué deseas hacer ahora?',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    }
  }
  
  /**
   * Formatea una fecha para mostrar
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha formateada
   */
  formatDate(date) {
    if (!date) return 'Fecha no disponible';
    
    const options = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(date).toLocaleDateString('es-MX', options);
  }
}
