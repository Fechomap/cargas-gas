// src/controllers/fuel/registro.controller.js
import { Markup } from 'telegraf';
import { FuelService } from '../../services/fuel.adapter.service.js';
import { KilometerService } from '../../services/kilometer.prisma.service.js';
import { unitController } from '../unit/index.js';
import { updateConversationState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';
import { storageService } from '../../services/storage.service.js';
import { getMainKeyboard } from '../../views/keyboards.js';
import { prisma } from '../../db/index.js';

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
      
      // Limpiar datos anteriores excepto información de unidad para nueva carga
      await updateConversationState(ctx, 'fuel_entry_kilometers', {
        unitId: unit.id,
        operatorName: unit.operatorName,
        unitNumber: unit.unitNumber,
        unitButtonId: unitButtonId,
        // Limpiar datos del registro anterior
        kilometers: null,
        liters: null,
        pricePerLiter: null,
        calculatedAmount: null,
        fuelType: null,
        saleNumber: null,
        paymentStatus: null,
        ticketPhoto: null
      });
      
      // Solicitar los kilómetros actuales (NUEVO PRIMER PASO)
      await ctx.reply(`Capturando carga para: ${unit.operatorName} - ${unit.unitNumber}`);
      await ctx.reply('Por favor, ingresa los kilómetros actuales de la unidad:');
    } catch (error) {
      logger.error(`Error al iniciar captura de carga: ${error.message}`);
      await ctx.reply('Error al iniciar la captura de carga. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Maneja la entrada de kilómetros en el flujo de captura (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleKilometersEntry(ctx) {
    try {
      const kilometersText = ctx.message.text.replace(',', '.');
      const kilometers = parseFloat(kilometersText);
      
      if (isNaN(kilometers) || kilometers < 0) {
        return await ctx.reply('Por favor, ingresa un número válido mayor o igual a cero.');
      }
      
      // Validar formato (máximo 2 decimales)
      const decimalPlaces = (kilometersText.split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        return await ctx.reply('Los kilómetros no pueden tener más de 2 decimales. Por favor, ingresa nuevamente.');
      }
      
      logger.info(`Validando kilómetros ${kilometers} para unidad ${ctx.session.data.unitId}`);
      
      // Validar kilómetros contra histórico usando KilometerService
      const validation = await KilometerService.validateKilometer(
        ctx.tenant.id,
        ctx.session.data.unitId,
        kilometers
      );
      
      if (!validation.isValid) {
        logger.warn(`Kilómetros inválidos: ${validation.message}`);
        
        // Mensaje de error detallado con información del último registro
        let errorMessage = `❌ ${validation.message}`;
        
        if (validation.lastKilometer) {
          errorMessage += `\n\n📊 Último registro:\n`;
          errorMessage += `• Kilómetros: ${validation.lastKilometer.kilometers}\n`;
          errorMessage += `• Fecha: ${new Date(validation.lastKilometer.date).toLocaleDateString('es-MX')}\n`;
          errorMessage += `• Fuente: ${validation.lastKilometer.source === 'turn_log' ? 'Log de turno' : 'Registro de carga'}`;
        }
        
        errorMessage += '\n\nPor favor, ingresa un kilómetro mayor o igual al último registrado.';
        
        return await ctx.reply(errorMessage);
      }
      
      // Si hay advertencia (incremento muy alto), informar pero continuar
      if (validation.warning) {
        logger.warn(`Advertencia en kilómetros: ${validation.message}`);
        await ctx.reply(`⚠️ ${validation.message}\n\nContinuando con el registro...`);
      }
      
      // Mostrar información útil para primer registro
      if (validation.isFirstRecord) {
        await ctx.reply('✨ Este es el primer registro de kilómetros para esta unidad.');
      } else if (validation.increment) {
        await ctx.reply(`✅ Kilómetros válidos. Incremento: +${validation.increment} km`);
      }
      
      // Guardar kilómetros en la sesión
      ctx.session.data.kilometers = kilometers;
      await updateConversationState(ctx, 'fuel_entry_liters');
      
      // Continuar con el flujo: solicitar litros
      await ctx.reply('Ahora ingresa la cantidad de litros cargados:');
      
    } catch (error) {
      logger.error(`Error en entrada de kilómetros: ${error.message}`);
      await ctx.reply('Ocurrió un error validando los kilómetros. Por favor, intenta nuevamente.');
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
      
      // Validar formato (máximo 2 decimales para litros)
      const decimalPlaces = (ctx.message.text.replace(',', '.').split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        return await ctx.reply('Los litros no pueden tener más de 2 decimales. Por favor, ingresa nuevamente.');
      }
      
      // Guardar litros en la sesión
      ctx.session.data.liters = liters;
      await updateConversationState(ctx, 'fuel_entry_price_per_liter');
      
      // Solicitar precio por litro (NUEVO PASO)
      await ctx.reply('Ingresa el precio por litro:');
    } catch (error) {
      logger.error(`Error en entrada de litros: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente los litros.');
    }
  }

  /**
   * Maneja la entrada del precio por litro en el flujo de captura (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handlePricePerLiterEntry(ctx) {
    try {
      const priceText = ctx.message.text.replace(/[$,\s]/g, '').replace(',', '.');
      const pricePerLiter = parseFloat(priceText);
      
      if (isNaN(pricePerLiter) || pricePerLiter <= 0) {
        return await ctx.reply('Por favor, ingresa un precio válido mayor a cero.');
      }
      
      // Validar formato (máximo 2 decimales para precio)
      const decimalPlaces = (priceText.split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        return await ctx.reply('El precio no puede tener más de 2 decimales. Por favor, ingresa nuevamente.');
      }
      
      // Guardar precio por litro en la sesión
      ctx.session.data.pricePerLiter = pricePerLiter;
      
      // Calcular monto automáticamente
      const liters = ctx.session.data.liters;
      const calculatedAmount = liters * pricePerLiter;
      
      // Guardar monto calculado
      ctx.session.data.calculatedAmount = calculatedAmount;
      await updateConversationState(ctx, 'fuel_entry_amount_confirm');
      
      // Mostrar cálculo y solicitar confirmación
      const calcMessage = `🧮 Cálculo automático:\n` +
                         `• ${liters} litros × $${pricePerLiter} = $${calculatedAmount.toFixed(2)}\n\n` +
                         `¿Es correcto este monto total?`;
      
      await ctx.reply(calcMessage, 
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Sí, es correcto', 'amount_confirm_yes'),
          Markup.button.callback('❌ No, corregir precio', 'amount_confirm_no')
        ])
      );
      
    } catch (error) {
      logger.error(`Error en entrada de precio por litro: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente el precio por litro.');
    }
  }

  /**
   * Maneja la confirmación del monto calculado (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {boolean} confirmed - Si el usuario confirmó el monto
   */
  async handleAmountConfirmation(ctx, confirmed) {
    try {
      if (confirmed) {
        // Usar el monto calculado
        ctx.session.data.amount = ctx.session.data.calculatedAmount;
        await updateConversationState(ctx, 'fuel_entry_type');
        
        // Continuar con tipo de combustible
        await ctx.reply('Selecciona el tipo de combustible:', 
          Markup.inlineKeyboard([
            Markup.button.callback('Gas', 'fuel_type_gas'),
            Markup.button.callback('Gasolina', 'fuel_type_gasolina'),
            Markup.button.callback('Diésel', 'fuel_type_diesel')
          ])
        );
      } else {
        // Volver a solicitar precio por litro
        await updateConversationState(ctx, 'fuel_entry_price_per_liter');
        await ctx.reply('Ingresa el precio por litro correcto:');
      }
    } catch (error) {
      logger.error(`Error en confirmación de monto: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Maneja la entrada del monto en el flujo de captura (OBSOLETO - mantenido para compatibilidad)
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
          Markup.button.callback('Gasolina', 'fuel_type_gasolina'),
          Markup.button.callback('Diésel', 'fuel_type_diesel')
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
      let photoResult = null;
      
      // Verificar si se envió una foto
      if (ctx.message?.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        // Preparar metadatos para el nuevo sistema de storage
        const tenantId = ctx.tenant?.id || ctx.session?.tenantId;
        logger.info(`DEBUG - TenantId obtenido: ${tenantId} (desde ctx.tenant: ${ctx.tenant?.id}, desde session: ${ctx.session?.tenantId})`);
        
        if (!tenantId) {
          logger.error('No se pudo obtener tenantId del contexto');
          throw new Error('No se pudo identificar el tenant para guardar la foto');
        }
        
        const metadata = {
          tenantId: tenantId,
          relatedType: 'fuel',
          uploadedBy: ctx.from.id.toString(),
          fileName: `ticket_${Date.now()}.jpg`,
          // relatedId se agregará después cuando se cree el registro de fuel
        };
        
        // Usar el nuevo sistema de storage con metadatos
        photoResult = await storageService.savePhotoFromTelegram(ctx, fileId, metadata);
        
        await ctx.reply(`📸 Foto del ticket recibida y almacenada ${photoResult.isR2Storage ? 'en R2' : 'localmente'}`);
        logger.info(`Foto guardada - ID: ${photoResult.id}, Storage: ${photoResult.isR2Storage ? 'R2' : 'Local'}`);
      } else {
        await ctx.reply('Foto omitida');
      }
      
      // Guardar información de la foto en la sesión
      ctx.session.data.ticketPhoto = photoResult?.storageKey || null;
      ctx.session.data.ticketPhotoId = photoResult?.id || null;
      
      // Actualizar el estado para solicitar el número de venta
      await updateConversationState(ctx, 'fuel_entry_sale_number');
      
      // Solicitar el número de venta
      await ctx.reply('Por favor, ingresa el número de venta (1 a 10 dígitos impresos en la nota):');
    } catch (error) {
      logger.error(`Error en manejo de foto: ${error.message}`);
      await ctx.reply('Ocurrió un error con la foto. Continuaremos sin foto del ticket.');
      
      // Continuar sin foto
      ctx.session.data.ticketPhoto = null;
      
      // Actualizar estado para pedir número de venta
      await updateConversationState(ctx, 'fuel_entry_sale_number');
      
      // Solicitar el número de venta
      await ctx.reply('Por favor, ingresa el número de venta (1 a 10 dígitos impresos en la nota):');
    }
  }
  
  /**
   * Procesa la entrada del número de venta
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleSaleNumberEntry(ctx) {
    try {
      const saleNumber = ctx.message.text.trim();
      
      // Validar formato: 1-10 caracteres alfanuméricos con guiones
      const saleNumberRegex = /^[A-Za-z0-9-]{1,10}$/;
      if (!saleNumberRegex.test(saleNumber)) {
        return await ctx.reply('❌ Formato inválido. Ingresa un número de venta de 1 a 10 caracteres (números, letras o guiones).');
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
        // NUEVOS CAMPOS DE KILÓMETROS
        kilometers: ctx.session.data.kilometers ? Number(ctx.session.data.kilometers) : null,
        pricePerLiter: ctx.session.data.pricePerLiter ? Number(ctx.session.data.pricePerLiter) : null,
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
      
      // Actualizar relación del archivo con el registro de combustible
      if (ctx.session.data.ticketPhotoId) {
        try {
          await prisma.fileStorage.update({
            where: { id: ctx.session.data.ticketPhotoId },
            data: { relatedId: savedFuel.id }
          });
          logger.info(`Archivo ${ctx.session.data.ticketPhotoId} vinculado al registro ${savedFuel.id}`);
        } catch (fileError) {
          logger.warn(`Error al vincular archivo: ${fileError.message}`);
          // No bloquear el flujo por error de vinculación
        }
      }
      
      await ctx.answerCbQuery('Carga guardada correctamente');
      await ctx.reply(`✅ Carga registrada correctamente con ID: ${savedFuel.id}`);
      
      // Iniciar verificación de fecha de registro
      const fechaController = await import('./fecha.controller.js').then(m => new m.FechaController());
      await fechaController.checkRecordDate(ctx, savedFuel);
      return;
    } catch (error) {
      logger.error(`Error al guardar carga: ${error.message}`);
      
      // Detectar si es un error de número de folio duplicado
      if (error.message.includes('Ya existe un registro activo con el número de nota')) {
        await ctx.reply(`❌ Error: ${error.message}. Por favor, utiliza un número de nota diferente.`);
        
        // Limpiar solo el número de nota en la sesión para permitir reintentar
        if (ctx.session && ctx.session.data) {
          ctx.session.data.saleNumber = null;
        }
        
        // Regresar al estado de entrada de número de nota
        await updateConversationState(ctx, 'fuel_entry_sale_number');
        await ctx.reply('Por favor, ingresa un número de nota diferente:');
        return;
      }
      
      // Otros errores
      await ctx.reply('Ocurrió un error al guardar la carga. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Finaliza el proceso de registro después de la verificación de fecha
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async completeFuelRegistration(ctx) {
    try {
      // Guardar datos importantes antes de limpiar
      const unitButtonId = ctx.session?.data?.unitButtonId;
      const operatorName = ctx.session?.data?.operatorName;
      const unitNumber = ctx.session?.data?.unitNumber;
      
      // Limpiar estado pero mantener datos esenciales para nueva carga
      await updateConversationState(ctx, 'idle', {
        unitButtonId: unitButtonId,
        operatorName: operatorName,
        unitNumber: unitNumber
      });
      
      await ctx.reply('¿Qué deseas hacer ahora?',
        Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar otra carga', 'register_fuel_start')],
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
