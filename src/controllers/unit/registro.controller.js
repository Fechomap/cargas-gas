// src/controllers/unit/registro.controller.js
import { unitService } from '../../services/unit.adapter.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador para gestionar el registro y actualización de unidades
 */
export class RegistroController {
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

      // Validar que el tenant esté presente en los datos
      if (!unitData.tenantId) {
        throw new Error('Se requiere el tenantId para registrar una unidad');
      }

      // Usar el servicio para registrar la unidad (usando findOrCreateUnit en lugar de createUnit)
      const unit = await unitService.findOrCreateUnit(unitData, unitData.tenantId);

      logger.info(`Unidad registrada con éxito: ${unit.id}`);
      return unit;
    } catch (error) {
      logger.error(`Error al registrar unidad: ${error.message}`);
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
      logger.info(`Desactivando unidad con ID: ${unitId}`);
      await unitService.deactivateUnit(unitId);
      return true;
    } catch (error) {
      logger.error(`Error al desactivar unidad: ${error.message}`);
      throw error;
    }
  }
}