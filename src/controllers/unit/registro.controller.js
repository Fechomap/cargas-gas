// src/controllers/unit/registro.controller.js
import { unitService } from '../../services/unit.adapter.service.js';
import { logger } from '../../utils/logger.js';
import { AuditService, AuditActions } from '../../services/audit.service.js';

/**
 * Controlador para gestionar el registro y actualización de unidades
 */
export class RegistroController {
  /**
   * Registra una nueva unidad en el sistema
   * @param {Object} unitData - Datos de la unidad a registrar
   * @param {Object} ctx - Contexto de Telegraf (opcional, para auditoría)
   * @returns {Promise<Object>} - Unidad registrada
   */
  async registerUnit(unitData, ctx = null) {
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

      // 🔍 AUDITORÍA: Registrar creación de unidad (si hay contexto)
      if (ctx && unit) {
        await AuditService.log({
          action: AuditActions.UNIT_CREATE,
          entity: 'Unit',
          entityId: unit.id,
          changes: {
            created: unitData,
            timestamp: new Date().toISOString()
          },
          ctx
        });
      }

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
   * @param {Object} ctx - Contexto de Telegraf (opcional, para auditoría)
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async deactivateUnit(unitId, ctx = null) {
    try {
      logger.info(`Desactivando unidad con ID: ${unitId}`);

      // Obtener la unidad antes de desactivarla para auditoría
      let unitData = null;
      if (ctx) {
        try {
          unitData = await unitService.getUnitById(unitId);
        } catch (error) {
          logger.warn(`No se pudo obtener datos de unidad para auditoría: ${error.message}`);
        }
      }

      await unitService.deactivateUnit(unitId);

      // 🔍 AUDITORÍA: Registrar desactivación de unidad
      if (ctx && unitData) {
        await AuditService.logDeletion({
          entity: 'Unit',
          entityId: unitId,
          deletedRecord: unitData,
          ctx,
          isHardDelete: false
        });
      }

      return true;
    } catch (error) {
      logger.error(`Error al desactivar unidad: ${error.message}`);
      throw error;
    }
  }
}