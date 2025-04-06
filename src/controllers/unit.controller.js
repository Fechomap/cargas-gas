// src/controllers/unit.controller.js
import { Markup } from 'telegraf';
// Removed duplicate import
import { Unit } from '../models/unit.model.js';
import { unitService } from '../services/unit.service.js';
import { logger } from '../utils/logger.js';
import { getUnitsKeyboard } from '../views/keyboards.js'; // Import the keyboard function

/**
 * Controlador para gestionar unidades (camionetas/grúas)
 */
class UnitController {
  /**
   * Registra una nueva unidad en el sistema
   * @param {Object} unitData - Datos de la unidad a registrar
   * @returns {Promise<Object>} - Unidad registrada
   */
  async registerUnit(unitData) {
    try {
      logger.info(`Registrando nueva unidad: ${unitData.operatorName} - ${unitData.unitNumber}`);
      
      // Validar datos de entrada
      if (!unitData.operatorName || !unitData.unitNumber) {
        throw new Error('Datos de unidad incompletos');
      }
      
      // Usar el servicio para registrar la unidad
      const unit = await unitService.createUnit(unitData);
      
      logger.info(`Unidad registrada con éxito: ${unit._id}`);
      return unit;
    } catch (error) {
      logger.error(`Error al registrar unidad: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Muestra las unidades registradas como botones en el chat
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showRegisteredUnits(ctx) {
    try {
      // Obtener todas las unidades activas
      const units = await unitService.getAllActiveUnits();
      
      if (units.length === 0) {
        return await ctx.reply('No hay unidades registradas. Usa el botón "Registrar unidad" para comenzar.');
      }
      
      // Crear botones para cada unidad
      const buttons = units.map(unit => {
        const buttonLabel = `${unit.operatorName} - ${unit.unitNumber}`;
        return [Markup.button.callback(buttonLabel, unit.buttonId)];
      });
      
      // Añadir botón para registrar nueva unidad y menú principal
      buttons.push([Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')]);
      buttons.push([Markup.button.callback('🏠 Menú principal', 'main_menu')]);
      
      // Mostrar teclado con unidades
      await ctx.reply('Unidades registradas:', 
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`Error al mostrar unidades: ${error.message}`);
      await ctx.reply('Error al cargar las unidades registradas.');
    }
  }
  
  /**
   * Obtiene una unidad por su buttonId
   * @param {string} buttonId - ID del botón asociado a la unidad
   * @returns {Promise<Object>} - Unidad encontrada
   */
  async getUnitByButtonId(buttonId) {
    try {
      return await unitService.getUnitByButtonId(buttonId);
    } catch (error) {
      logger.error(`Error al obtener unidad por buttonId: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Elimina una unidad (desactivación lógica)
   * @param {string} unitId - ID de la unidad a eliminar
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async deactivateUnit(unitId) {
    try {
      await unitService.deactivateUnit(unitId);
      return true;
    } catch (error) {
      logger.error(`Error al desactivar unidad: ${error.message}`);
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
      // Obtener todas las unidades activas
      const units = await unitService.getAllActiveUnits();
      
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

export const unitController = new UnitController();
