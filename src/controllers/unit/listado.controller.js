// src/controllers/unit/listado.controller.js
import { Markup } from 'telegraf';
import { unitService } from '../../services/unit.adapter.service.js';
import { logger } from '../../utils/logger.js';
import { getUnitsKeyboard } from '../../views/keyboards.js';

/**
 * Controlador para gestionar el listado y selección de unidades
 */
export class ListadoController {
  /**
   * Muestra las unidades registradas como botones en el chat
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {String} action - Acción a realizar cuando se selecciona una unidad
   */
  async showRegisteredUnits(ctx, action = 'select_unit') {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      logger.info(`Obteniendo unidades activas para tenant: ${tenantId}`);
      
      // Obtener todas las unidades activas con el tenantId
      const units = await unitService.getAllActiveUnits(tenantId);
      
      if (units.length === 0) {
        return await ctx.reply('No hay unidades registradas. Usa el botón "Registrar unidad" para comenzar.');
      }
      
      // Crear botones para cada unidad con la acción correspondiente
      const buttons = units.map(unit => {
        const buttonLabel = `${unit.operatorName} - ${unit.unitNumber}`;
        // Usar el parámetro action para determinar el callback_data
        return [Markup.button.callback(buttonLabel, `${action}_unit_${unit.buttonId}`)];
      });
      
      // Añadir botón para registrar nueva unidad y menú principal
      buttons.push([Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')]);
      buttons.push([Markup.button.callback('🏠 Menú principal', 'main_menu')]);
      
      // Mostrar teclado con unidades
      await ctx.reply('Selecciona una unidad:', 
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`Error al mostrar unidades: ${error.message}`);
      return ctx.reply(`Error al obtener unidades: ${error.message}`);
    }
  }

  /**
   * Muestra las unidades registradas para desactivar (borrado lógico)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showUnitsForDeactivation(ctx) {
    await this.showRegisteredUnits(ctx, 'deactivate');
  }

  /**
   * Desactiva una unidad (borrado lógico)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async deactivateUnit(ctx) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      // Extraer el buttonId del callback_data
      const callbackData = ctx.callbackQuery.data;
      const buttonId = callbackData.replace('deactivate_unit_', '');
      
      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      
      // Desactivar la unidad
      await unitService.deactivateUnit(buttonId, tenantId, true); // true indica que es por buttonId
      
      await ctx.answerCbQuery('Unidad desactivada correctamente');
      await ctx.reply('✅ La unidad ha sido desactivada exitosamente. Ya no aparecerá en los listados ni podrá ser utilizada para registrar cargas.', 
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al desactivar unidad: ${error.message}`);
      await ctx.answerCbQuery('Error al desactivar la unidad');
      return ctx.reply(`❌ Error al desactivar la unidad: ${error.message}`, 
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Intentar de nuevo', 'manage_units')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  }

  /**
   * Obtiene una unidad por su buttonId
   * @param {object} ctx - Contexto de Telegraf con tenant
   * @param {string} buttonId - ID del botón asociado a la unidad
   * @returns {Promise<Object>} - Unidad encontrada
   */
  async getUnitByButtonId(ctx, buttonId) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        throw new Error('No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      logger.info(`Buscando unidad con buttonId: ${buttonId} para tenant: ${tenantId}`);
      
      return await unitService.findUnitByButtonId(buttonId, tenantId);
    } catch (error) {
      logger.error(`Error al obtener unidad por buttonId: ${error.message}`);
      throw error;
    }
  }

  /**
   * Muestra las unidades para que el usuario seleccione una para registrar carga
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async requestUnitSelectionForFuel(ctx) {
    try {
      logger.info(`Solicitando selección de unidad para carga (Usuario: ${ctx.from.id})`);
      
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      
      // Obtener todas las unidades activas para este tenant
      const units = await unitService.getAllActiveUnits(tenantId);
      
      // Usar la función getUnitsKeyboard para generar el teclado
      const keyboard = getUnitsKeyboard(units); 
      
      // Enviar mensaje con el teclado
      // Nota: getUnitsKeyboard ya maneja el caso de 0 unidades.
      await ctx.reply('Selecciona la unidad a la que deseas registrar una carga:', keyboard);
      
    } catch (error) {
      logger.error(`Error al solicitar selección de unidad para carga: ${error.message}`);
      await ctx.reply('Ocurrió un error al cargar las unidades. Por favor, intenta volver al menú principal.');
      // Opcional: Mostrar botón de menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      });
    }
  }
}