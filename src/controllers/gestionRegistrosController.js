// src/controllers/gestionRegistrosController.js
import { Markup } from 'telegraf';
import { FuelService } from '../services/fuel.adapter.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/index.js';

/**
 * Controlador para gestión CRUD completa de registros de combustible
 * Funciones: Buscar, Editar, Eliminar, Desactivar
 */
export class GestionRegistrosController {
  constructor() {
    this.fuelService = new FuelService();
  }

  /**
   * Muestra el menú principal de gestión de registros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showMainMenu(ctx) {
    try {
      logger.info(`Administrador ${ctx.from.id} accedió al menú de gestión de registros`);
      
      await ctx.reply('📝 *Gestión de Registros*\n\nSelecciona el tipo de gestión que deseas realizar:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⛽ Gestionar cargas', callback_data: 'manage_fuel_records_search' }],
            [{ text: '📏 Gestionar kilómetros', callback_data: 'manage_km_records' }],
            [{ text: '🏠 Volver al menú admin', callback_data: 'admin_menu' }]
          ]
        }
      });
      
      logger.info(`Menú de gestión enviado exitosamente al administrador ${ctx.from.id}`);
    } catch (error) {
      logger.error(`Error al mostrar menú de gestión: ${error.message}`);
      await ctx.reply('Error al mostrar el menú de gestión.');
    }
  }

  /**
   * Inicia la búsqueda de registros de combustible para gestión
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startFuelRecordSearch(ctx) {
    try {
      logger.info(`Iniciando búsqueda de registros para gestión (Usuario: ${ctx.from.id})`);
      
      // Actualizar estado de conversación
      await updateConversationState(ctx, 'gestion_search_fuel', {});
      
      await ctx.reply(
        '🔍 *Buscar registro para gestionar*\n\n' +
        'Ingresa el número de nota del registro que deseas gestionar:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancelar', callback_data: 'manage_fuel_records' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al iniciar búsqueda de gestión: ${error.message}`);
      await ctx.reply('Error al iniciar la búsqueda.');
    }
  }

  /**
   * Procesa la búsqueda y muestra opciones de gestión
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleSearchInput(ctx) {
    try {
      const searchQuery = ctx.message.text.trim();
      
      if (!searchQuery) {
        return await ctx.reply('Por favor, ingresa un número de nota válido.');
      }
      
      logger.info(`Buscando registro para gestión: ${searchQuery}`);
      
      // Verificar tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return await ctx.reply('Error: No se pudo identificar el grupo.');
      }
      
      // Buscar registro por número de nota
      const fuel = await this.fuelService.findBySaleNumber(searchQuery, ctx.tenant.id);
      
      if (!fuel) {
        await ctx.reply(`⚠️ No se encontró registro con el número: ${searchQuery}`);
        await ctx.reply('Por favor, verifica el número e intenta nuevamente.');
        return;
      }
      
      // Guardar información en sesión
      ctx.session.data.managingFuelId = fuel.id;
      ctx.session.data.managingFuelData = fuel;
      
      logger.info(`Registro encontrado para gestión: ID ${fuel.id}`);
      
      // Mostrar información del registro y opciones de gestión
      await this.showRecordManagementOptions(ctx, fuel);
      
    } catch (error) {
      logger.error(`Error en búsqueda para gestión: ${error.message}`);
      await ctx.reply('Error durante la búsqueda. Intenta nuevamente.');
    }
  }

  /**
   * Muestra las opciones de gestión para un registro específico
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} fuel - Registro de combustible
   */
  async showRecordManagementOptions(ctx, fuel) {
    try {
      // Mostrar información completa del registro
      const recordInfo = `📝 INFORMACIÓN DEL REGISTRO

Número de nota: ${fuel.saleNumber}
Operador: ${fuel.operatorName}
Unidad: ${fuel.unitNumber}
Fecha: ${this.formatDate(fuel.recordDate)}
Kilómetros: ${fuel.kilometers || 'N/A'}
Litros: ${fuel.liters.toFixed(2)}
Monto: $${fuel.amount.toFixed(2)}
Tipo: ${fuel.fuelType}
Estado: ${fuel.paymentStatus}
Activo: ${fuel.isActive ? 'Sí' : 'No'}`;

      await ctx.reply(recordInfo, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Editar', callback_data: `edit_fuel_${fuel.id}` }],
            [{ text: '🗑️ Eliminar', callback_data: `delete_fuel_${fuel.id}` }],
            [{ text: '🔍 Buscar otro', callback_data: 'manage_fuel_records_search' }],
            [{ text: '🏠 Menú admin', callback_data: 'admin_menu' }]
          ]
        }
      });
      
      // Limpiar estado de búsqueda
      await updateConversationState(ctx, 'idle', {});
      
    } catch (error) {
      logger.error(`Error al mostrar opciones de gestión: ${error.message}`);
      await ctx.reply('Error al mostrar las opciones.');
    }
  }

  /**
   * Muestra el menú de edición de campos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelId - ID del registro a editar
   */
  async showEditMenu(ctx, fuelId) {
    try {
      const fuel = await FuelService.getFuelById(fuelId, ctx.tenant.id);
      
      if (!fuel) {
        await ctx.answerCbQuery('Registro no encontrado');
        return await ctx.reply('El registro no existe o no tienes permisos para editarlo.');
      }
      
      const editInfo = `✏️ EDITAR REGISTRO

REGISTRO ACTUAL:
• Kilómetros: ${fuel.kilometers || 'N/A'}
• Litros: ${fuel.liters.toFixed(2)}
• Monto: $${fuel.amount.toFixed(2)}
• Tipo: ${fuel.fuelType}
• Nota: ${fuel.saleNumber}
• Estado: ${fuel.paymentStatus}

Selecciona el campo que deseas editar:`;

      await ctx.reply(editInfo, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📏 Kilómetros', callback_data: `edit_field_km_${fuelId}` }],
            [{ text: '💧 Litros', callback_data: `edit_field_liters_${fuelId}` }],
            [{ text: '💰 Precio por litro', callback_data: `edit_field_price_${fuelId}` }],
            [{ text: '⛽ Tipo combustible', callback_data: `edit_field_type_${fuelId}` }],
            [{ text: '📝 Número de nota', callback_data: `edit_field_sale_${fuelId}` }],
            [{ text: '💳 Estado de pago', callback_data: `edit_field_payment_${fuelId}` }],
            [{ text: '🔙 Volver', callback_data: `show_fuel_options_${fuelId}` }],
            [{ text: '🏠 Menú admin', callback_data: 'admin_menu' }]
          ]
        }
      });
      
    } catch (error) {
      logger.error(`Error al mostrar menú de edición: ${error.message}`);
      await ctx.answerCbQuery('Error al cargar editor');
      await ctx.reply('Error al cargar el editor.');
    }
  }

  /**
   * Inicia la edición de un campo específico
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} field - Campo a editar
   * @param {string} fuelId - ID del registro
   */
  async startFieldEdit(ctx, field, fuelId) {
    try {
      logger.info(`CONTROLLER: startFieldEdit llamado - field: ${field}, fuelId: ${fuelId}`);
      
      // Verificar que el registro existe
      const fuel = await FuelService.getFuelById(fuelId, ctx.tenant.id);
      if (!fuel) {
        logger.error(`CONTROLLER: Registro no encontrado para fuelId: ${fuelId}`);
        await ctx.reply('Error: Registro no encontrado.');
        return;
      }
      
      logger.info(`CONTROLLER: Registro encontrado para edición: ${fuel.id}`);

      // Asegurar que la sesión esté inicializada
      if (!ctx.session) {
        ctx.session = {};
      }
      if (!ctx.session.data) {
        ctx.session.data = {};
      }
      
      // Guardar información en sesión
      ctx.session.data.editingField = field;
      ctx.session.data.editingFuelId = fuelId;
      ctx.session.data.editingFuelData = fuel;
      
      logger.info(`CONTROLLER: Guardando en sesión - field: ${field}, fuelId: ${fuelId}`);

      // Actualizar estado de conversación (sin sobrescribir los datos de sesión)
      await updateConversationState(ctx, 'editing_fuel_field', null);

      // Mensajes específicos por campo
      const prompts = {
        km: `📏 EDITANDO KILÓMETROS\n\nValor actual: ${fuel.kilometers || 'N/A'}\n\nIngresa los nuevos kilómetros:`,
        liters: `💧 EDITANDO LITROS\n\nValor actual: ${fuel.liters.toFixed(2)}\n\nIngresa los nuevos litros:\n\n💡 El monto se recalculará automáticamente`,
        price: `💰 EDITANDO PRECIO POR LITRO\n\nValor actual: $${fuel.pricePerLiter ? fuel.pricePerLiter.toFixed(2) : 'N/A'}\n\nIngresa el nuevo precio por litro:\n\n💡 El monto se recalculará automáticamente`,
        type: `⛽ EDITANDO TIPO DE COMBUSTIBLE\n\nValor actual: ${fuel.fuelType}\n\nSelecciona el nuevo tipo:`,
        sale: `📝 EDITANDO NÚMERO DE NOTA\n\nValor actual: ${fuel.saleNumber}\n\nIngresa el nuevo número de nota:`,
        payment: `💳 EDITANDO ESTADO DE PAGO\n\nValor actual: ${fuel.paymentStatus}\n\nSelecciona el nuevo estado:`
      };

      if (field === 'type') {
        // Mostrar opciones de tipo de combustible
        await ctx.reply(prompts[field], {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⛽ Gas', callback_data: 'update_field_GAS' }],
              [{ text: '🚗 Gasolina', callback_data: 'update_field_GASOLINA' }],
              [{ text: '🚛 Diésel', callback_data: 'update_field_DIESEL' }],
              [{ text: '❌ Cancelar', callback_data: `edit_fuel_${fuelId}` }]
            ]
          }
        });
      } else if (field === 'payment') {
        // Mostrar solo la opción contraria al estado actual
        const currentStatus = fuel.paymentStatus;
        const oppositeStatus = currentStatus === 'PAGADA' ? 'NO_PAGADA' : 'PAGADA';
        const oppositeLabel = oppositeStatus === 'PAGADA' ? '✅ Marcar como PAGADA' : '❌ Marcar como NO_PAGADA';
        
        await ctx.reply(prompts[field], {
          reply_markup: {
            inline_keyboard: [
              [{ text: oppositeLabel, callback_data: `update_field_${oppositeStatus}` }],
              [{ text: '❌ Cancelar', callback_data: `edit_fuel_${fuelId}` }]
            ]
          }
        });
      } else {
        // Para campos de texto/número, solicitar entrada
        await ctx.reply(prompts[field] || 'Ingresa el nuevo valor:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancelar', callback_data: `edit_fuel_${fuelId}` }]
            ]
          }
        });
      }

    } catch (error) {
      logger.error(`Error al iniciar edición de campo: ${error.message}`);
      await ctx.reply('Error al iniciar la edición.');
    }
  }

  /**
   * Procesa la entrada de texto para edición de campo
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleFieldEditInput(ctx) {
    try {
      logger.info('CONTROLLER: handleFieldEditInput iniciado');
      
      const field = ctx.session.data.editingField;
      const fuelId = ctx.session.data.editingFuelId;
      const newValue = ctx.message.text.trim();

      logger.info(`CONTROLLER: handleFieldEditInput - field: ${field}, fuelId: ${fuelId}, newValue: ${newValue}`);

      if (!field || !fuelId) {
        logger.error('CONTROLLER: Error - field o fuelId no disponibles');
        await ctx.reply('Error: Información de edición no disponible.');
        return;
      }

      // Validar entrada según el campo
      let validatedValue = newValue;
      
      if (field === 'km' || field === 'liters' || field === 'price') {
        const numValue = parseFloat(newValue);
        if (isNaN(numValue) || numValue < 0) {
          await ctx.reply('❌ El valor debe ser un número positivo. Intenta nuevamente:');
          return;
        }
        validatedValue = numValue;
      }

      // Actualizar el registro
      await this.updateFuelField(ctx, fuelId, field, validatedValue);

    } catch (error) {
      logger.error(`Error al procesar entrada de edición: ${error.message}`);
      await ctx.reply('Error al procesar la edición.');
    }
  }

  /**
   * Actualiza un campo específico del registro
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelId - ID del registro
   * @param {string} field - Campo a actualizar
   * @param {any} value - Nuevo valor
   */
  async updateFuelField(ctx, fuelId, field, value) {
    try {
      logger.info(`Actualizando campo ${field} con valor ${value} para fuelId: ${fuelId}`);
      
      // Mapear campos a nombres de base de datos
      const fieldMap = {
        km: 'kilometers',
        liters: 'liters',
        price: 'pricePerLiter',
        type: 'fuelType',
        sale: 'saleNumber',
        payment: 'paymentStatus'
      };

      const dbField = fieldMap[field];
      if (!dbField) {
        throw new Error(`Campo no válido: ${field}`);
      }

      // Actualizar en base de datos
      const updateData = { [dbField]: value };
      
      // Si editamos litros o precio por litro, recalcular el monto
      if (field === 'liters' || field === 'price') {
        const currentFuel = await prisma.fuel.findUnique({
          where: { id: fuelId, tenantId: ctx.tenant.id }
        });
        
        if (currentFuel) {
          const newLiters = field === 'liters' ? value : currentFuel.liters;
          const newPrice = field === 'price' ? value : (currentFuel.pricePerLiter || 0);
          updateData.amount = newLiters * newPrice;
        }
      }
      
      // Si es estado de pago y se marca como pagada, agregar fecha
      if (field === 'payment' && value === 'PAGADA') {
        updateData.paymentDate = new Date();
      }

      logger.info(`Datos de actualización:`, updateData);
      
      const updatedFuel = await prisma.fuel.update({
        where: { 
          id: fuelId,
          tenantId: ctx.tenant.id
        },
        data: updateData
      });

      logger.info(`Campo actualizado exitosamente en base de datos para fuelId: ${fuelId}`);

      // Limpiar estado de edición
      await updateConversationState(ctx, 'idle', {});
      delete ctx.session.data.editingField;
      delete ctx.session.data.editingFuelId;
      delete ctx.session.data.editingFuelData;

      // Mostrar confirmación
      const fieldNames = {
        km: 'Kilómetros',
        liters: 'Litros',
        price: 'Precio por litro',
        type: 'Tipo de combustible',
        sale: 'Número de nota',
        payment: 'Estado de pago'
      };

      let confirmationMessage = `✅ Campo actualizado exitosamente\n\n${fieldNames[field]}: ${value}`;
      
      // Si se recalculó el monto, mostrarlo en la confirmación
      if (field === 'liters' || field === 'price') {
        confirmationMessage += `\n💡 Monto recalculado: $${updatedFuel.amount.toFixed(2)}`;
      }
      
      await ctx.reply(confirmationMessage);

      // Mostrar información actualizada del registro
      await this.showRecordManagementOptions(ctx, updatedFuel);

    } catch (error) {
      logger.error(`Error al actualizar campo: ${error.message}`);
      await ctx.reply('❌ Error al actualizar el campo. Por favor, intenta nuevamente.');
    }
  }

  /**
   * Formatea una fecha a string legible
   * @param {Date} date - Fecha a formatear
   * @returns {string}
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

export const gestionRegistrosController = new GestionRegistrosController();