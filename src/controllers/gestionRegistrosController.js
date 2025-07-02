// src/controllers/gestionRegistrosController.js
import { Markup } from 'telegraf';
import { FuelService } from '../services/fuel.adapter.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/index.js';
import { AuditService, AuditActions } from '../services/audit.service.js';

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

      // Obtener el estado anterior para auditoría
      const currentFuel = await prisma.fuel.findUnique({
        where: { id: fuelId, tenantId: ctx.tenant.id }
      });

      if (!currentFuel) {
        throw new Error('Registro no encontrado');
      }

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

      // Preparar datos de actualización
      const updateData = { [dbField]: value };

      // Si editamos litros o precio por litro, recalcular el monto
      if (field === 'liters' || field === 'price') {
        const newLiters = field === 'liters' ? value : currentFuel.liters;
        const newPrice = field === 'price' ? value : (currentFuel.pricePerLiter || 0);
        updateData.amount = newLiters * newPrice;
      }

      // Si es estado de pago y se marca como pagada, agregar fecha
      if (field === 'payment' && value === 'PAGADA') {
        updateData.paymentDate = new Date();
      }

      logger.info('Datos de actualización:', updateData);

      const updatedFuel = await prisma.fuel.update({
        where: {
          id: fuelId,
          tenantId: ctx.tenant.id
        },
        data: updateData
      });

      // 🔍 AUDITORÍA: Registrar el cambio
      await AuditService.logUpdate({
        entity: 'Fuel',
        entityId: fuelId,
        before: currentFuel,
        after: updatedFuel,
        ctx,
        fieldName: field
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

  // ============= GESTIÓN DE KILÓMETROS =============

  /**
   * Muestra el menú de gestión de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showKilometerMenu(ctx) {
    try {
      logger.info(`Mostrando menú de gestión de kilómetros para admin ${ctx.from.id}`);

      await ctx.reply(
        '📏 *Gestión de Registros de Kilómetros*\n\n' +
        'Selecciona una opción para buscar registros:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚛 Por unidad', callback_data: 'km_search_by_unit' }],
              [{ text: '📅 Por fecha', callback_data: 'km_search_by_date' }],
              [{ text: '📊 Ver últimos registros', callback_data: 'km_view_recent' }],
              [{ text: '🔙 Volver', callback_data: 'manage_fuel_records' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al mostrar menú de kilómetros: ${error.message}`);
      await ctx.reply('Error al mostrar el menú.');
    }
  }

  /**
   * Muestra los últimos registros de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showRecentKilometerLogs(ctx) {
    try {
      logger.info('Obteniendo registros recientes de kilómetros');

      const recentLogs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isOmitted: false
        },
        include: { Unit: true },
        orderBy: { logTime: 'desc' },
        take: 10
      });

      if (recentLogs.length === 0) {
        await ctx.reply('No se encontraron registros de kilómetros.');
        return;
      }

      let message = '📏 *Últimos 10 registros de kilómetros:*\n\n';

      for (const log of recentLogs) {
        const typeIcon = log.logType === 'INICIO_TURNO' ? '🟢' : '🔴';
        const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin';

        message += `${typeIcon} *${typeText}* - Unidad ${log.Unit.unitNumber}\n`;
        message += `├ Kilómetros: ${log.kilometers}\n`;
        message += `├ Fecha: ${this.formatDate(log.logDate)}\n`;
        message += `├ Hora: ${this.formatDate(log.logTime)}\n`;
        message += `└ ID: \`${log.id.substring(0, 8)}\`\n\n`;
      }

      const buttons = recentLogs.map(log => [{
        text: `${log.Unit.unitNumber} - ${log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin'} (${this.formatDateShort(log.logDate)})`,
        callback_data: `km_manage_${log.id.substring(0, 8)}`
      }]);

      buttons.push([{ text: '🔙 Volver', callback_data: 'manage_km_records' }]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    } catch (error) {
      logger.error(`Error al mostrar registros recientes: ${error.message}`);
      await ctx.reply('Error al obtener los registros.');
    }
  }

  /**
   * Inicia búsqueda de kilómetros por unidad
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startKmSearchByUnit(ctx) {
    try {
      await updateConversationState(ctx, 'km_search_unit', {});

      await ctx.reply(
        '🚛 *Buscar por unidad*\n\n' +
        'Ingresa el número de unidad:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancelar', callback_data: 'manage_km_records' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al iniciar búsqueda por unidad: ${error.message}`);
      await ctx.reply('Error al iniciar la búsqueda.');
    }
  }

  /**
   * Procesa búsqueda de kilómetros por unidad
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleKmUnitSearch(ctx) {
    try {
      const unitNumber = ctx.message.text.trim();

      if (!unitNumber) {
        return await ctx.reply('Por favor, ingresa un número de unidad válido.');
      }

      logger.info(`Buscando registros de kilómetros para unidad: ${unitNumber}`);

      // Buscar la unidad
      const unit = await prisma.unit.findFirst({
        where: {
          tenantId: ctx.tenant.id,
          unitNumber: unitNumber,
          isActive: true
        }
      });

      if (!unit) {
        await ctx.reply(`⚠️ No se encontró la unidad: ${unitNumber}`);
        return;
      }

      // Buscar registros de kilómetros
      const logs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          unitId: unit.id,
          isOmitted: false
        },
        orderBy: { logDate: 'desc' },
        take: 20
      });

      if (logs.length === 0) {
        await ctx.reply(`No se encontraron registros de kilómetros para la unidad ${unitNumber}.`);
        return;
      }

      await this.displayKilometerLogs(ctx, logs, unit);

    } catch (error) {
      logger.error(`Error en búsqueda por unidad: ${error.message}`);
      await ctx.reply('Error durante la búsqueda.');
    }
  }

  /**
   * Muestra lista de registros de kilómetros con opciones
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Array} logs - Registros de kilómetros
   * @param {Object} unit - Información de la unidad
   */
  async displayKilometerLogs(ctx, logs, unit) {
    try {
      let message = `📏 *Registros de kilómetros - Unidad ${unit.unitNumber}*\n`;
      message += `Operador: ${unit.operatorName}\n\n`;

      const buttons = logs.slice(0, 10).map(log => {
        const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin';
        const dateText = this.formatDateShort(log.logDate);
        return [{
          text: `${typeText} - ${dateText} - ${log.kilometers} km`,
          callback_data: `km_manage_${log.id.substring(0, 8)}`
        }];
      });

      buttons.push([{ text: '🔙 Volver', callback_data: 'manage_km_records' }]);

      for (const log of logs.slice(0, 5)) {
        const typeIcon = log.logType === 'INICIO_TURNO' ? '🟢' : '🔴';
        const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin';

        message += `${typeIcon} *${typeText}*\n`;
        message += `├ Kilómetros: ${log.kilometers}\n`;
        message += `├ Fecha: ${this.formatDate(log.logDate)}\n`;
        message += `└ ID: \`${log.id.substring(0, 8)}\`\n\n`;
      }

      if (logs.length > 5) {
        message += `\n... y ${logs.length - 5} registros más`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });

      // Limpiar estado
      await updateConversationState(ctx, 'idle', {});

    } catch (error) {
      logger.error(`Error al mostrar registros: ${error.message}`);
      await ctx.reply('Error al mostrar los registros.');
    }
  }

  /**
   * Muestra opciones de gestión para un registro de kilómetros específico
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} logId - ID del registro (primeros 8 caracteres)
   */
  async showKmManagementOptions(ctx, logIdShort) {
    try {
      // Buscar el registro completo
      const log = await prisma.kilometerLog.findFirst({
        where: {
          id: {
            startsWith: logIdShort
          },
          tenantId: ctx.tenant.id
        },
        include: { Unit: true }
      });

      if (!log) {
        await ctx.answerCbQuery('Registro no encontrado');
        return;
      }

      const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio de turno' : 'Fin de turno';

      const info = `📏 *INFORMACIÓN DEL REGISTRO*

*Tipo:* ${typeText}
*Unidad:* ${log.Unit.unitNumber}
*Operador:* ${log.Unit.operatorName}
*Kilómetros:* ${log.kilometers}
*Fecha:* ${this.formatDate(log.logDate)}
*Hora registro:* ${this.formatDate(log.logTime)}
*Estado:* ${log.isOmitted ? 'Omitido' : 'Activo'}`;

      await ctx.reply(info, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Editar kilómetros', callback_data: `km_edit_${log.id}` }],
            [{ text: '🗑️ Eliminar registro', callback_data: `km_delete_${log.id}` }],
            [{ text: '🔙 Volver', callback_data: 'km_view_recent' }],
            [{ text: '🏠 Menú admin', callback_data: 'admin_menu' }]
          ]
        }
      });
    } catch (error) {
      logger.error(`Error al mostrar opciones de gestión km: ${error.message}`);
      await ctx.reply('Error al cargar el registro.');
    }
  }

  /**
   * Inicia edición de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} logId - ID del registro
   */
  async startKmEdit(ctx, logId) {
    try {
      const log = await prisma.kilometerLog.findUnique({
        where: { id: logId },
        include: { Unit: true }
      });

      if (!log) {
        await ctx.answerCbQuery('Registro no encontrado');
        return;
      }

      // Guardar en sesión
      ctx.session.data.editingKmId = logId;
      ctx.session.data.editingKmData = log;

      await updateConversationState(ctx, 'editing_km_value', null);

      await ctx.reply(
        '📏 *EDITANDO KILÓMETROS*\n\n' +
        `Registro: ${log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin'} de turno\n` +
        `Unidad: ${log.Unit.unitNumber}\n` +
        `Valor actual: ${log.kilometers} km\n\n` +
        'Ingresa el nuevo valor de kilómetros:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancelar', callback_data: `km_manage_${log.id.substring(0, 8)}` }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al iniciar edición de km: ${error.message}`);
      await ctx.reply('Error al iniciar la edición.');
    }
  }

  /**
   * Procesa la edición de kilómetros con validaciones de secuencia
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleKmEditInput(ctx) {
    try {
      const newValue = ctx.message.text.trim();
      const kmValue = parseFloat(newValue);

      if (isNaN(kmValue) || kmValue < 0) {
        await ctx.reply('❌ El valor debe ser un número positivo. Intenta nuevamente:');
        return;
      }

      const logId = ctx.session.data.editingKmId;
      const oldLog = ctx.session.data.editingKmData;

      // Validar secuencia de kilómetros
      const validation = await this.validateKilometerSequence(ctx, oldLog, kmValue);

      if (!validation.isValid) {
        let warningMessage = `⚠️ *Advertencia de Secuencia*\n\n${validation.message}\n\n`;

        if (validation.suggestions && validation.suggestions.length > 0) {
          warningMessage += '*Sugerencias:*\n';
          validation.suggestions.forEach(suggestion => {
            warningMessage += `• ${suggestion}\n`;
          });
          warningMessage += '\n';
        }

        warningMessage += '¿Deseas continuar de todas formas?';

        await ctx.reply(warningMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Sí, continuar', callback_data: `km_force_update_${logId}_${kmValue}` },
                { text: '❌ Cancelar', callback_data: `km_manage_${logId.substring(0, 8)}` }
              ]
            ]
          }
        });
        return;
      }

      // Si la validación es exitosa, proceder con la actualización
      await this.executeKmUpdate(ctx, logId, oldLog, kmValue);

    } catch (error) {
      logger.error(`Error al actualizar kilómetros: ${error.message}`);
      await ctx.reply('❌ Error al actualizar los kilómetros.');
    }
  }

  /**
   * Valida la secuencia de kilómetros para evitar inconsistencias
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} currentLog - Registro actual
   * @param {number} newKmValue - Nuevo valor de kilómetros
   * @returns {Object} Resultado de validación
   */
  async validateKilometerSequence(ctx, currentLog, newKmValue) {
    try {
      // Buscar registros relacionados de la misma unidad
      const relatedLogs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          unitId: currentLog.unitId,
          isOmitted: false,
          id: { not: currentLog.id } // Excluir el registro actual
        },
        orderBy: [
          { logDate: 'asc' },
          { logTime: 'asc' }
        ]
      });

      const warnings = [];
      const suggestions = [];
      let isValid = true;

      // Encontrar registros anteriores y posteriores
      const currentDate = new Date(currentLog.logDate);
      const currentTime = new Date(currentLog.logTime);

      const previousLogs = relatedLogs.filter(log => {
        const logDateTime = new Date(log.logTime);
        return logDateTime < currentTime;
      }).sort((a, b) => new Date(b.logTime) - new Date(a.logTime));

      const nextLogs = relatedLogs.filter(log => {
        const logDateTime = new Date(log.logTime);
        return logDateTime > currentTime;
      }).sort((a, b) => new Date(a.logTime) - new Date(b.logTime));

      // Validar con registro anterior
      if (previousLogs.length > 0) {
        const previousLog = previousLogs[0];
        if (newKmValue < previousLog.kilometers) {
          warnings.push(`El nuevo valor (${newKmValue} km) es menor al registro anterior (${previousLog.kilometers} km) del ${this.formatDate(previousLog.logTime)}.`);
          suggestions.push(`Considerar un valor mayor a ${previousLog.kilometers} km`);
          isValid = false;
        }
      }

      // Validar con registro posterior
      if (nextLogs.length > 0) {
        const nextLog = nextLogs[0];
        if (newKmValue > nextLog.kilometers) {
          warnings.push(`El nuevo valor (${newKmValue} km) es mayor al registro posterior (${nextLog.kilometers} km) del ${this.formatDate(nextLog.logTime)}.`);
          suggestions.push(`Considerar un valor menor a ${nextLog.kilometers} km`);
          isValid = false;
        }
      }

      // Validar diferencias dramáticas
      const originalValue = currentLog.kilometers;
      const difference = Math.abs(newKmValue - originalValue);

      if (difference > 1000) {
        warnings.push(`Cambio dramático detectado: diferencia de ${difference} km con el valor original.`);
        suggestions.push('Verificar que el valor sea correcto');
        isValid = false;
      }

      // Validar secuencia lógica de inicio/fin de turno
      if (currentLog.logType === 'INICIO_TURNO') {
        const samedayEndLogs = nextLogs.filter(log => {
          const logDate = new Date(log.logDate);
          const currentLogDate = new Date(currentLog.logDate);
          return log.logType === 'FIN_TURNO' &&
                 logDate.toDateString() === currentLogDate.toDateString();
        });

        if (samedayEndLogs.length > 0) {
          const endLog = samedayEndLogs[0];
          if (newKmValue >= endLog.kilometers) {
            warnings.push(`Un inicio de turno no puede tener kilómetros iguales o mayores al fin de turno del mismo día (${endLog.kilometers} km).`);
            suggestions.push(`Usar un valor menor a ${endLog.kilometers} km`);
            isValid = false;
          }
        }
      }

      return {
        isValid,
        message: warnings.join('\n\n'),
        suggestions,
        warnings
      };

    } catch (error) {
      logger.error(`Error en validación de secuencia: ${error.message}`);
      return {
        isValid: true, // En caso de error, permitir la actualización
        message: 'No se pudo validar la secuencia, pero se puede continuar.',
        suggestions: [],
        warnings: []
      };
    }
  }

  /**
   * Ejecuta la actualización de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} logId - ID del registro
   * @param {Object} oldLog - Registro anterior
   * @param {number} kmValue - Nuevo valor
   */
  async executeKmUpdate(ctx, logId, oldLog, kmValue) {
    try {
      // Actualizar registro
      const updatedLog = await prisma.kilometerLog.update({
        where: { id: logId },
        data: { kilometers: kmValue }
      });

      // 🔍 AUDITORÍA: Registrar actualización de kilómetros
      await AuditService.logUpdate({
        entity: 'KilometerLog',
        entityId: logId,
        before: oldLog,
        after: updatedLog,
        ctx,
        fieldName: 'kilometers'
      });

      logger.info(`Kilómetros actualizados: ${oldLog.kilometers} -> ${kmValue} para registro ${logId}`);

      // Limpiar sesión
      await updateConversationState(ctx, 'idle', {});
      delete ctx.session.data.editingKmId;
      delete ctx.session.data.editingKmData;

      await ctx.reply(
        '✅ *Kilómetros actualizados exitosamente*\n\n' +
        `Valor anterior: ${oldLog.kilometers} km\n` +
        `Nuevo valor: ${kmValue} km`,
        { parse_mode: 'Markdown' }
      );

      // Mostrar opciones del registro actualizado
      await this.showKmManagementOptions(ctx, logId.substring(0, 8));

    } catch (error) {
      logger.error(`Error al ejecutar actualización: ${error.message}`);
      await ctx.reply('❌ Error al actualizar los kilómetros.');
    }
  }

  /**
   * Confirma eliminación de registro de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} logId - ID del registro
   */
  async confirmKmDeletion(ctx, logId) {
    try {
      const log = await prisma.kilometerLog.findUnique({
        where: { id: logId },
        include: { Unit: true }
      });

      if (!log) {
        await ctx.answerCbQuery('Registro no encontrado');
        return;
      }

      const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio de turno' : 'Fin de turno';

      await ctx.reply(
        '⚠️ *CONFIRMAR ELIMINACIÓN*\n\n' +
        '¿Estás seguro de eliminar este registro?\n\n' +
        `*Tipo:* ${typeText}\n` +
        `*Unidad:* ${log.Unit.unitNumber}\n` +
        `*Kilómetros:* ${log.kilometers}\n` +
        `*Fecha:* ${this.formatDate(log.logDate)}\n\n` +
        'Esta acción marcará el registro como omitido.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Sí, eliminar', callback_data: `km_delete_confirm_${logId}` },
                { text: '❌ Cancelar', callback_data: `km_manage_${logId.substring(0, 8)}` }
              ]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al confirmar eliminación: ${error.message}`);
      await ctx.reply('Error al procesar la solicitud.');
    }
  }

  /**
   * Ejecuta eliminación de registro de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} logId - ID del registro
   */
  async executeKmDeletion(ctx, logId) {
    try {
      // Obtener el registro antes de eliminarlo para auditoría
      const kmLog = await prisma.kilometerLog.findUnique({
        where: { id: logId },
        include: { Unit: true }
      });

      if (!kmLog) {
        await ctx.reply('❌ Registro no encontrado.');
        return;
      }

      // Marcar como omitido en lugar de eliminar físicamente
      await prisma.kilometerLog.update({
        where: { id: logId },
        data: { isOmitted: true }
      });

      // 🔍 AUDITORÍA: Registrar eliminación lógica
      await AuditService.logDeletion({
        entity: 'KilometerLog',
        entityId: logId,
        deletedRecord: kmLog,
        ctx,
        isHardDelete: false
      });

      logger.info(`Registro de kilómetros ${logId} marcado como omitido`);

      await ctx.reply('✅ Registro eliminado exitosamente.');

      // Volver al menú de kilómetros
      await this.showKilometerMenu(ctx);

    } catch (error) {
      logger.error(`Error al eliminar registro: ${error.message}`);
      await ctx.reply('❌ Error al eliminar el registro.');
    }
  }

  /**
   * Maneja el input de búsqueda por unidad para kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} unitNumber - Número de unidad
   */
  async handleKmUnitSearch(ctx, unitNumber) {
    try {
      // Buscar la unidad
      const unit = await prisma.unit.findFirst({
        where: {
          tenantId: ctx.tenant.id,
          unitNumber: unitNumber.toString(),
          isActive: true
        }
      });

      if (!unit) {
        await ctx.reply(
          `❌ No se encontró la unidad "${unitNumber}" o está inactiva.\n\n` +
          'Ingresa otro número de unidad o cancela la búsqueda:',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancelar', callback_data: 'manage_km_records' }]
              ]
            }
          }
        );
        return;
      }

      // Buscar registros de kilómetros de la unidad
      const kmLogs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          unitId: unit.id,
          isOmitted: false
        },
        include: { Unit: true },
        orderBy: [
          { logDate: 'desc' },
          { logTime: 'desc' }
        ],
        take: 20 // Últimos 20 registros
      });

      if (kmLogs.length === 0) {
        await ctx.reply(
          `📏 No se encontraron registros de kilómetros para la unidad ${unitNumber}.\n\n` +
          '¿Deseas buscar otra unidad?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Nueva búsqueda', callback_data: 'km_search_by_unit' }],
                [{ text: '🔙 Volver', callback_data: 'manage_km_records' }]
              ]
            }
          }
        );
        return;
      }

      await this.showKmResultsByUnit(ctx, unit, kmLogs);

    } catch (error) {
      logger.error(`Error en búsqueda por unidad: ${error.message}`);
      await ctx.reply('❌ Error al buscar registros de la unidad.');
    }
  }

  /**
   * Muestra los resultados de kilómetros por unidad
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} unit - Datos de la unidad
   * @param {Array} kmLogs - Registros de kilómetros
   */
  async showKmResultsByUnit(ctx, unit, kmLogs) {
    try {
      let message = `📏 *Registros de Kilómetros - Unidad ${unit.unitNumber}*\n`;
      message += `*Operador:* ${unit.operatorName}\n\n`;

      // Agregar información de registros
      for (const log of kmLogs.slice(0, 10)) { // Mostrar solo los primeros 10
        const typeIcon = log.logType === 'INICIO_TURNO' ? '🟢' : '🔴';
        const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin';
        const statusText = log.isOmitted ? ' (Omitido)' : '';

        message += `${typeIcon} *${typeText}*${statusText}\n`;
        message += `├ Kilómetros: ${log.kilometers}\n`;
        message += `├ Fecha: ${this.formatDate(log.logDate)}\n`;
        message += `└ Hora: ${this.formatDate(log.logTime)}\n\n`;
      }

      if (kmLogs.length > 10) {
        message += `_... y ${kmLogs.length - 10} registros más_\n\n`;
      }

      // Crear botones para gestionar cada registro
      const buttons = kmLogs.slice(0, 8).map(log => [{
        text: `${log.logType === 'INICIO_TURNO' ? '🟢' : '🔴'} ${this.formatDateShort(log.logDate)} - ${log.kilometers}km`,
        callback_data: `km_manage_${log.id.substring(0, 8)}`
      }]);

      buttons.push([
        { text: '🔍 Nueva búsqueda', callback_data: 'km_search_by_unit' },
        { text: '🔙 Volver', callback_data: 'manage_km_records' }
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });

      // Limpiar estado
      await updateConversationState(ctx, 'idle', {});

    } catch (error) {
      logger.error(`Error al mostrar resultados por unidad: ${error.message}`);
      await ctx.reply('❌ Error al mostrar los resultados.');
    }
  }

  /**
   * Implementa búsqueda por fecha para registros de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showKmSearchByDate(ctx) {
    try {
      await ctx.reply(
        '📅 *Búsqueda por Fecha*\n\n' +
        'Selecciona el período de búsqueda:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Hoy', callback_data: 'km_date_today' }],
              [{ text: '📅 Ayer', callback_data: 'km_date_yesterday' }],
              [{ text: '📅 Últimos 7 días', callback_data: 'km_date_week' }],
              [{ text: '📅 Último mes', callback_data: 'km_date_month' }],
              [{ text: '📝 Fecha específica', callback_data: 'km_date_custom' }],
              [{ text: '🔙 Volver', callback_data: 'manage_km_records' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al mostrar búsqueda por fecha: ${error.message}`);
      await ctx.reply('❌ Error al mostrar la opción.');
    }
  }

  /**
   * Busca registros por período predefinido
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} period - Período (today, yesterday, week, month)
   */
  async searchKmByPeriod(ctx, period) {
    try {
      let startDate, endDate;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (period) {
      case 'today':
        startDate = today;
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'yesterday':
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case 'week':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      default:
        throw new Error('Período no válido');
      }

      const logs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isOmitted: false,
          logDate: {
            gte: startDate,
            lt: endDate
          }
        },
        include: { Unit: true },
        orderBy: [
          { logDate: 'desc' },
          { logTime: 'desc' }
        ],
        take: 50
      });

      if (logs.length === 0) {
        const periodNames = {
          today: 'hoy',
          yesterday: 'ayer',
          week: 'los últimos 7 días',
          month: 'el último mes'
        };

        await ctx.reply(
          `📅 No se encontraron registros de kilómetros para ${periodNames[period]}.\n\n` +
          '¿Deseas buscar en otro período?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Buscar otra fecha', callback_data: 'km_search_by_date' }],
                [{ text: '🔙 Volver', callback_data: 'manage_km_records' }]
              ]
            }
          }
        );
        return;
      }

      await this.displayKmSearchResults(ctx, logs, period);

    } catch (error) {
      logger.error(`Error en búsqueda por período: ${error.message}`);
      await ctx.reply('❌ Error al buscar registros.');
    }
  }

  /**
   * Inicia búsqueda por fecha específica
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startCustomDateSearch(ctx) {
    try {
      await updateConversationState(ctx, 'km_custom_date', {});

      await ctx.reply(
        '📅 *Búsqueda por Fecha Específica*\n\n' +
        'Ingresa la fecha en formato DD/MM/AAAA\n' +
        'Ejemplo: 01/07/2025\n\n' +
        'O ingresa solo DD/MM para el año actual:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancelar', callback_data: 'km_search_by_date' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error(`Error al iniciar búsqueda personalizada: ${error.message}`);
      await ctx.reply('❌ Error al iniciar la búsqueda.');
    }
  }

  /**
   * Procesa búsqueda por fecha personalizada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateSearch(ctx) {
    try {
      const dateInput = ctx.message.text.trim();

      // Validar formato de fecha
      let date;
      const currentYear = new Date().getFullYear();

      if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Formato DD/MM/AAAA
        const [day, month, year] = dateInput.split('/').map(n => parseInt(n));
        date = new Date(year, month - 1, day);
      } else if (dateInput.match(/^\d{1,2}\/\d{1,2}$/)) {
        // Formato DD/MM (año actual)
        const [day, month] = dateInput.split('/').map(n => parseInt(n));
        date = new Date(currentYear, month - 1, day);
      } else {
        await ctx.reply(
          '❌ Formato de fecha inválido.\n\n' +
          'Usa: DD/MM/AAAA o DD/MM\n' +
          'Ejemplo: 01/07/2025 o 01/07\n\n' +
          'Intenta nuevamente:'
        );
        return;
      }

      if (isNaN(date.getTime())) {
        await ctx.reply(
          '❌ Fecha inválida.\n\n' +
          'Verifica que el día y mes sean correctos.\n' +
          'Intenta nuevamente:'
        );
        return;
      }

      // Buscar registros para la fecha específica
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      const logs = await prisma.kilometerLog.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isOmitted: false,
          logDate: {
            gte: startDate,
            lt: endDate
          }
        },
        include: { Unit: true },
        orderBy: [
          { logTime: 'desc' }
        ]
      });

      if (logs.length === 0) {
        await ctx.reply(
          `📅 No se encontraron registros para el ${this.formatDateShort(date)}.\n\n` +
          '¿Deseas buscar otra fecha?',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Nueva fecha', callback_data: 'km_date_custom' }],
                [{ text: '🔙 Volver', callback_data: 'km_search_by_date' }]
              ]
            }
          }
        );
        return;
      }

      await this.displayKmSearchResults(ctx, logs, 'custom', date);

      // Limpiar estado
      await updateConversationState(ctx, 'idle', {});

    } catch (error) {
      logger.error(`Error en búsqueda personalizada: ${error.message}`);
      await ctx.reply('❌ Error al procesar la fecha.');
    }
  }

  /**
   * Muestra resultados de búsqueda de kilómetros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Array} logs - Registros encontrados
   * @param {string} period - Período buscado
   * @param {Date} customDate - Fecha personalizada (opcional)
   */
  async displayKmSearchResults(ctx, logs, period, customDate = null) {
    try {
      const periodNames = {
        today: 'Hoy',
        yesterday: 'Ayer',
        week: 'Últimos 7 días',
        month: 'Último mes',
        custom: customDate ? this.formatDateShort(customDate) : 'Fecha específica'
      };

      let message = `📅 *Registros de Kilómetros - ${periodNames[period]}*\n\n`;
      message += `Total encontrados: ${logs.length}\n\n`;

      // Agrupar por unidad para mejor visualización
      const logsByUnit = {};
      for (const log of logs) {
        const unitNum = log.Unit.unitNumber;
        if (!logsByUnit[unitNum]) {
          logsByUnit[unitNum] = [];
        }
        logsByUnit[unitNum].push(log);
      }

      // Mostrar por unidad
      for (const [unitNum, unitLogs] of Object.entries(logsByUnit)) {
        message += `🚛 *Unidad ${unitNum}*\n`;

        for (const log of unitLogs.slice(0, 3)) { // Máximo 3 por unidad
          const typeIcon = log.logType === 'INICIO_TURNO' ? '🟢' : '🔴';
          const typeText = log.logType === 'INICIO_TURNO' ? 'Inicio' : 'Fin';

          message += `${typeIcon} ${typeText} - ${log.kilometers}km`;
          message += ` (${this.formatDate(log.logTime).split(' ')[1]})\n`;
        }

        if (unitLogs.length > 3) {
          message += `_... y ${unitLogs.length - 3} más_\n`;
        }
        message += '\n';
      }

      // Crear botones para gestionar registros
      const buttons = logs.slice(0, 8).map(log => [{
        text: `${log.Unit.unitNumber} - ${log.logType === 'INICIO_TURNO' ? '🟢' : '🔴'} ${log.kilometers}km`,
        callback_data: `km_manage_${log.id.substring(0, 8)}`
      }]);

      buttons.push([
        { text: '📅 Nueva búsqueda', callback_data: 'km_search_by_date' },
        { text: '🔙 Volver', callback_data: 'manage_km_records' }
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });

    } catch (error) {
      logger.error(`Error al mostrar resultados de búsqueda: ${error.message}`);
      await ctx.reply('❌ Error al mostrar los resultados.');
    }
  }

  /**
   * Muestra las opciones de gestión de un registro específico obteniendo datos de BD
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelId - ID del registro de combustible
   */
  async showRecordManagementOptionsByID(ctx, fuelId) {
    try {
      // Buscar el registro directamente en la base de datos
      const fuel = await prisma.fuel.findUnique({
        where: {
          id: fuelId,
          tenantId: ctx.tenant.id
        },
        include: {
          Unit: true
        }
      });

      if (!fuel) {
        await ctx.reply('❌ Registro no encontrado o no tienes permisos para verlo.');
        return;
      }

      // Formatear datos para mostrar
      const fuelData = {
        id: fuel.id,
        saleNumber: fuel.saleNumber,
        operatorName: fuel.Unit.operatorName,
        unitNumber: fuel.Unit.unitNumber,
        recordDate: fuel.recordDate,
        kilometers: fuel.kilometers,
        liters: fuel.liters,
        amount: fuel.amount,
        fuelType: fuel.fuelType,
        paymentStatus: fuel.paymentStatus,
        isActive: fuel.isActive
      };

      // Llamar a la función existente con los datos formateados
      await this.showRecordManagementOptions(ctx, fuelData);

    } catch (error) {
      logger.error(`Error al mostrar opciones por ID: ${error.message}`);
      await ctx.reply('❌ Error al cargar la información del registro.');
    }
  }

  /**
   * Formatea fecha corta
   * @param {Date} date - Fecha
   * @returns {string}
   */
  formatDateShort(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }
}

export const gestionRegistrosController = new GestionRegistrosController();