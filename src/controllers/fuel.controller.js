// src/controllers/fuel.controller.js
import { Markup } from 'telegraf';
import { fuelService } from '../services/fuel.service.js';
import { unitController } from './unit.controller.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { storageService } from '../services/storage.service.js';
import { getMainKeyboard } from '../views/keyboards.js';

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
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente el número de venta.');
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
🧾 Número de venta: ${ctx.session.data.saleNumber || 'No proporcionado'}
💳 Estatus: ${ctx.session.data.paymentStatus}
🧾 Ticket: ${ctx.session.data.ticketPhoto ? 'Incluido' : 'No incluido'}
      `;
      
      // IMPORTANTE: Usar Markup explícitamente con botones de callback correctos
      await ctx.reply(summary, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Guardar', callback_data: 'fuel_confirm_save' }],
            [{ text: '❌ Cancelar', callback_data: 'fuel_confirm_cancel' }]
          ]
        }
      });
      
      logger.info(`Mostrando botones de confirmación para usuario ${ctx.from.id}`);
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
        fuelType: ctx.session.data.fuelType || 'gas',
        saleNumber: ctx.session.data.saleNumber || null,
        paymentStatus: ctx.session.data.paymentStatus || 'no pagada',
        ticketPhoto: ctx.session.data.ticketPhoto || null,
        operatorName: ctx.session.data.operatorName,
        unitNumber: ctx.session.data.unitNumber
      };
      
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
      
      // Guardar en la base de datos con log detallado de cada paso
      logger.info('Llamando a fuelService.createFuelEntry()');
      const savedFuel = await fuelService.createFuelEntry(fuelData);
      logger.info(`Carga guardada con ID: ${savedFuel._id}`);
      
      await ctx.answerCbQuery('Carga guardada correctamente');
      await ctx.reply(`✅ Carga registrada correctamente con ID: ${savedFuel._id}`);

      // Iniciar verificación de fecha de registro
      await this.checkRecordDate(ctx, savedFuel);
      return;
    } catch (error) {
      logger.error(`Error al guardar carga: ${error.message}`);
      logger.error(error.stack || 'No stack trace disponible');
      await ctx.answerCbQuery('Error al guardar');
      await ctx.reply('Ocurrió un error al guardar la carga. Por favor, intenta nuevamente.');
      
      // Añadir botón para volver al menú principal incluso después de error
      await ctx.reply('¿Qué deseas hacer ahora?', 
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      );
    }
  }

  /**
   * Verifica si la fecha de registro debe ser ajustada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} savedFuel - Registro de combustible guardado
   */
  async checkRecordDate(ctx, savedFuel) {
    try {
      logger.info(`Verificando fecha de registro para carga ${savedFuel._id}`);
      
      // Guardar el ID de la carga guardada en la sesión para referencia posterior
      ctx.session.data.savedFuelId = savedFuel._id;
      await updateConversationState(ctx, 'fuel_date_confirm');
      
      // Preguntar si la carga se realizó hoy
      await ctx.reply('¿La recarga se realizó hoy?',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sí, es de hoy', 'fuel_date_today')],
          [Markup.button.callback('❌ No, es de otra fecha', 'fuel_date_other')]
        ])
      );
    } catch (error) {
      logger.error(`Error al verificar fecha de registro: ${error.message}`);
      // En caso de error, consideramos que la fecha es correcta y continuamos
      await this.completeFuelRegistration(ctx);
    }
  }

  /**
   * Muestra opciones para seleccionar una fecha reciente
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showDateOptions(ctx) {
    try {
      await ctx.answerCbQuery('Selecciona la fecha real de la carga');
      await updateConversationState(ctx, 'fuel_date_select');
      
      const buttons = [];
      
      // Ayer
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      buttons.push([Markup.button.callback(
        `Ayer (${this.formatDate(yesterday)})`,
        `fuel_date_day_1`
      )]);
      
      // Antier
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      buttons.push([Markup.button.callback(
        `Antier (${this.formatDate(twoDaysAgo)})`,
        `fuel_date_day_2`
      )]);
      
      // Días 3 al 7
      for (let i = 3; i <= 7; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - i);
        buttons.push([Markup.button.callback(
          `Hace ${i} días (${this.formatDate(pastDate)})`,
          `fuel_date_day_${i}`
        )]);
      }
      
      // Opción personalizada y cancelar
      buttons.push([Markup.button.callback('📅 Elegir otra fecha', 'fuel_date_custom')]);
      buttons.push([Markup.button.callback('Cancelar (usar fecha actual)', 'fuel_date_cancel')]);
      
      await ctx.reply('Selecciona la fecha real de la carga:',
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`Error al mostrar opciones de fecha: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar la selección de fecha.');
      await this.completeFuelRegistration(ctx);
    }
  }

  /**
   * Ajusta la fecha de registro según los días seleccionados
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {number} daysAgo - Días hacia atrás desde hoy
   */
  async updateRecordDate(ctx, daysAgo) {
    try {
      if (!ctx.session.data.savedFuelId) {
        throw new Error('No se encontró referencia a la carga guardada');
      }
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - daysAgo);
      newDate.setHours(12, 0, 0, 0);
      
      const updatedFuel = await fuelService.updateRecordDate(
        ctx.session.data.savedFuelId,
        newDate
      );
      
      await ctx.answerCbQuery('Fecha actualizada correctamente');
      await ctx.reply(`✅ Fecha de carga actualizada a: ${this.formatDate(newDate)}`);
      await this.completeFuelRegistration(ctx);
    } catch (error) {
      logger.error(`Error al actualizar fecha de registro: ${error.message}`);
      await ctx.answerCbQuery('Error al actualizar fecha');
      await ctx.reply('Ocurrió un error al actualizar la fecha. La carga se registró con la fecha actual.');
      await this.completeFuelRegistration(ctx);
    }
  }

  /**
   * Solicita al usuario ingresar una fecha manual
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async requestCustomDate(ctx) {
    try {
      await ctx.answerCbQuery('Ingresa la fecha manualmente');
      await updateConversationState(ctx, 'fuel_date_custom_input');
      await ctx.reply(
        'Por favor, ingresa la fecha en formato DD/MM/AAAA\n' +
        'Ejemplo: 25/04/2025\n\n' +
        'La fecha no puede ser posterior a hoy ni anterior a 30 días'
      );
    } catch (error) {
      logger.error(`Error al solicitar fecha personalizada: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar la solicitud.');
      await this.completeFuelRegistration(ctx);
    }
  }

  /**
   * Procesa la entrada de fecha manual del usuario
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateInput(ctx) {
    try {
      const dateText = ctx.message.text.trim();
      const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = dateText.match(dateRegex);
      
      if (!match) {
        return await ctx.reply(
          '❌ Formato de fecha incorrecto.\n' +
          'Por favor, usa el formato DD/MM/AAAA (ejemplo: 25/04/2025):'
        );
      }
      
      const [, day, month, year] = match;
      const inputDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      
      if (isNaN(inputDate.getTime())) {
        return await ctx.reply('❌ Fecha inválida. Por favor, ingresa una fecha real:');
      }
      
      const today = new Date();
      if (inputDate > today) {
        return await ctx.reply('❌ La fecha no puede ser posterior a hoy. Por favor, ingresa otra fecha:');
      }
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (inputDate < thirtyDaysAgo) {
        return await ctx.reply('❌ La fecha no puede ser anterior a 30 días. Por favor, ingresa otra fecha:');
      }
      
      if (!ctx.session.data.savedFuelId) {
        throw new Error('No se encontró referencia a la carga guardada');
      }
      
      const updatedFuel = await fuelService.updateRecordDate(
        ctx.session.data.savedFuelId,
        inputDate
      );
      
      await ctx.reply(`✅ Fecha de carga actualizada a: ${this.formatDate(inputDate)}`);
      await this.completeFuelRegistration(ctx);
    } catch (error) {
      logger.error(`Error al procesar fecha personalizada: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar la fecha. La carga se registró con la fecha actual.');
      await this.completeFuelRegistration(ctx);
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
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
  
  /**
     * Inicia el flujo de búsqueda de nota por número de venta
     * @param {TelegrafContext} ctx - Contexto de Telegraf
     */
  async startNoteSearch(ctx) {
    try {
      logger.info(`Usuario ${ctx.from.id} inició búsqueda de nota para pago`);
      
      // Actualizar estado de conversación
      await updateConversationState(ctx, 'search_note_input', {});
      
      // Solicitar número de nota con un teclado de cancelar INTEGRADO
      await ctx.reply('Por favor, ingresa el número de venta (número de nota) que deseas buscar:', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar búsqueda', 'cancel_note_search')]
        ])
      });
      
    } catch (error) {
      logger.error(`Error al iniciar búsqueda de nota: ${error.message}`);
      await ctx.reply('Ocurrió un error al iniciar la búsqueda. Por favor, intenta nuevamente.');
      
      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  }
  
  /**
     * Procesa la entrada del número de venta para búsqueda
     * @param {TelegrafContext} ctx - Contexto de Telegraf
     */
  async handleNoteSearchInput(ctx) {
    try {
      const saleNumber = ctx.message.text.trim();
      
      if (!saleNumber) {
        return await ctx.reply('Por favor, ingresa un número de venta válido:');
      }
      
      // Buscar la nota por número de venta
      const fuel = await fuelService.findBySaleNumber(saleNumber);
      
      if (!fuel) {
        await ctx.reply(`⚠️ No se encontró ninguna nota con el número: ${saleNumber}`);
        await ctx.reply('Por favor, verifica el número e intenta nuevamente o cancela la operación.');
        return;
      }
      
      // Guardar el ID de la nota en la sesión
      ctx.session.data.noteId = fuel._id;
      
      // Verificar si la nota ya está pagada
      if (fuel.paymentStatus === 'pagada') {
        await ctx.reply(`⚠️ Nota #${saleNumber} ya está marcada como pagada.`);
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
        noteId: fuel._id,
        saleNumber: fuel.saleNumber
      });
      
      // Registrar en log que vamos a mostrar los botones para nota no pagada
      logger.info(`Mostrando resumen y botones para nota no pagada #${saleNumber}`);
      
      // Mostrar resumen de la nota
      const noteDetails = `
  📝 *Nota encontrada*
  🔢 *Número:* ${fuel.saleNumber}
  👤 *Operador:* ${fuel.operatorName}
  🚚 *Unidad:* ${fuel.unitNumber}
  ⛽ *Tipo:* ${fuel.fuelType}
  📅 *Fecha:* ${this.formatDate(fuel.recordDate)}
  💰 *Monto:* $${fuel.amount.toFixed(2)}
  🔢 *Litros:* ${fuel.liters.toFixed(2)}
  💳 *Estatus:* ${fuel.paymentStatus}`;
      
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
      
      // Registrar confirmación de que se enviaron los botones
      logger.info(`Botones de pago enviados para nota #${saleNumber}`);
      
    } catch (error) {
      logger.error(`Error al procesar búsqueda de nota: ${error.message}`);
      await ctx.reply('Ocurrió un error al buscar la nota. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Marca la nota seleccionada como pagada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async markNoteAsPaid(ctx) {
    try {
      if (!ctx.session?.data?.noteId) {
        await ctx.answerCbQuery('Error: No se encontró referencia a la nota');
        await ctx.reply('Ocurrió un error. No se encontró referencia a la nota seleccionada.');
        return;
      }
      
      const noteId = ctx.session.data.noteId;
      
      // Marcar como pagada
      const updatedFuel = await fuelService.markAsPaid(noteId);
      
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
   * Marca la nota seleccionada como pagada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async markNoteAsPaid(ctx) {
    try {
      if (!ctx.session?.data?.noteId) {
        await ctx.answerCbQuery('Error: No se encontró referencia a la nota');
        await ctx.reply('Ocurrió un error. No se encontró referencia a la nota seleccionada.');
        return;
      }
      
      const noteId = ctx.session.data.noteId;
      
      // Marcar como pagada
      const updatedFuel = await fuelService.markAsPaid(noteId);
      
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
}

export const fuelController = new FuelController();