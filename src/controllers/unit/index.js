// src/controllers/unit/index.js
import { ListadoController } from './listado.controller.js';
import { RegistroController } from './registro.controller.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador principal para gestionar unidades
 */
class UnitController {
  constructor() {
    this.listadoController = new ListadoController();
    this.registroController = new RegistroController();
    
    logger.info('UnitController: Inicializado');
  }
  
  /**
   * Registra una nueva unidad en el sistema
   * @param {Object} unitData - Datos de la unidad a registrar
   * @returns {Promise<Object>} - Unidad registrada
   */
  async registerUnit(unitData) {
    return await this.registroController.registerUnit(unitData);
  }
  
  /**
   * Muestra las unidades registradas como botones en el chat
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {String} action - Acción a realizar cuando se selecciona una unidad
   */
  async showRegisteredUnits(ctx, action = 'select_unit') {
    return await this.listadoController.showRegisteredUnits(ctx, action);
  }
  
  /**
   * Obtiene una unidad por su buttonId
   * @param {object} ctx - Contexto de Telegraf con tenant
   * @param {string} buttonId - ID del botón asociado a la unidad
   * @returns {Promise<Object>} - Unidad encontrada
   */
  async getUnitByButtonId(ctx, buttonId) {
    return await this.listadoController.getUnitByButtonId(ctx, buttonId);
  }
  
  /**
   * Muestra el listado de unidades para su desactivación
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showUnitsForDeactivation(ctx) {
    return await this.listadoController.showUnitsForDeactivation(ctx);
  }
  
  /**
   * Desactiva una unidad (borrado lógico)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async deactivateUnit(ctx) {
    return await this.listadoController.deactivateUnit(ctx);
  }

  /**
   * Muestra las unidades para que el usuario seleccione una para registrar carga
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async requestUnitSelectionForFuel(ctx) {
    return await this.listadoController.requestUnitSelectionForFuel(ctx);
  }
}

export const unitController = new UnitController();