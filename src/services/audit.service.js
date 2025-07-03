// src/services/audit.service.js
import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Tipos de acciones de auditoría
 */
export const AuditActions = {
  // Combustible
  FUEL_CREATE: 'FUEL_CREATE',
  FUEL_UPDATE: 'FUEL_UPDATE',
  FUEL_DELETE: 'FUEL_DELETE',
  FUEL_DEACTIVATE: 'FUEL_DEACTIVATE',
  FUEL_PAYMENT_UPDATE: 'FUEL_PAYMENT_UPDATE',

  // Kilómetros
  KM_CREATE: 'KM_CREATE',
  KM_UPDATE: 'KM_UPDATE',
  KM_DELETE: 'KM_DELETE',
  KM_FORCE_UPDATE: 'KM_FORCE_UPDATE', // Cuando se fuerza un cambio con advertencia

  // Unidades
  UNIT_CREATE: 'UNIT_CREATE',
  UNIT_UPDATE: 'UNIT_UPDATE',
  UNIT_DEACTIVATE: 'UNIT_DEACTIVATE',
  UNIT_REACTIVATE: 'UNIT_REACTIVATE'
};

/**
 * Servicio de auditoría para registrar cambios administrativos
 */
export class AuditService {
  /**
   * Registra una acción en el log de auditoría
   * @param {Object} options - Opciones para el registro
   * @param {string} options.action - Tipo de acción (CREATE, UPDATE, DELETE, etc.)
   * @param {string} options.entity - Entidad afectada (Fuel, KilometerLog, Unit, etc.)
   * @param {string} options.entityId - ID del registro afectado
   * @param {Object} options.changes - Cambios realizados (antes/después)
   * @param {Object} options.ctx - Contexto de Telegraf
   * @param {Object} options.additionalMetadata - Metadata adicional opcional
   * @returns {Promise<Object>} Registro de auditoría creado
   */
  static async log({
    action,
    entity,
    entityId,
    changes = null,
    ctx,
    additionalMetadata = {}
  }) {
    try {
      // Construir nombre de usuario
      const userName = ctx.from.username ||
        `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() ||
        'Usuario sin nombre';

      // Construir metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        chatId: ctx.chat?.id?.toString(),
        chatType: ctx.chat?.type,
        messageId: ctx.message?.message_id || ctx.callbackQuery?.message?.message_id,
        updateType: ctx.updateType,
        ...additionalMetadata
      };

      // Crear registro de auditoría
      const auditLog = await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenant.id,
          userId: ctx.from.id.toString(),
          userName,
          action,
          entity,
          entityId,
          changes,
          metadata
        }
      });

      logger.info(`Auditoría registrada: ${action} en ${entity} ID:${entityId} por ${userName}`);

      return auditLog;
    } catch (error) {
      // No fallar la operación principal si falla la auditoría
      logger.error(`Error al registrar auditoría: ${error.message}`, {
        action,
        entity,
        entityId,
        error: error.stack
      });
      return null;
    }
  }

  /**
   * Registra una actualización con cambios antes/después
   * @param {Object} options - Opciones para el registro
   * @param {string} options.entity - Entidad afectada
   * @param {string} options.entityId - ID del registro
   * @param {Object} options.before - Estado anterior
   * @param {Object} options.after - Estado nuevo
   * @param {Object} options.ctx - Contexto de Telegraf
   * @param {string} options.fieldName - Nombre del campo modificado (opcional)
   * @returns {Promise<Object>} Registro de auditoría
   */
  static async logUpdate({
    entity,
    entityId,
    before,
    after,
    ctx,
    fieldName = null
  }) {
    // Calcular qué campos cambiaron
    const changedFields = {};
    const beforeValues = {};
    const afterValues = {};

    for (const key in after) {
      if (before[key] !== after[key]) {
        beforeValues[key] = before[key];
        afterValues[key] = after[key];
        changedFields[key] = true;
      }
    }

    const changes = {
      before: beforeValues,
      after: afterValues,
      changedFields: Object.keys(changedFields),
      fieldName // Si se especifica un campo específico
    };

    return await this.log({
      action: AuditActions.FUEL_UPDATE,
      entity,
      entityId,
      changes,
      ctx
    });
  }

  /**
   * Registra una eliminación/desactivación
   * @param {Object} options - Opciones para el registro
   * @param {string} options.entity - Entidad afectada
   * @param {string} options.entityId - ID del registro
   * @param {Object} options.deletedRecord - Registro eliminado/desactivado
   * @param {Object} options.ctx - Contexto de Telegraf
   * @param {boolean} options.isHardDelete - Si es eliminación física o lógica
   * @returns {Promise<Object>} Registro de auditoría
   */
  static async logDeletion({
    entity,
    entityId,
    deletedRecord,
    ctx,
    isHardDelete = false
  }) {
    const action = isHardDelete ?
      `${entity.toUpperCase()}_DELETE` :
      `${entity.toUpperCase()}_DEACTIVATE`;

    return await this.log({
      action,
      entity,
      entityId,
      changes: {
        deletedRecord,
        isHardDelete,
        timestamp: new Date().toISOString()
      },
      ctx
    });
  }

  /**
   * Obtiene el historial de cambios de una entidad
   * @param {string} tenantId - ID del tenant
   * @param {string} entity - Tipo de entidad
   * @param {string} entityId - ID de la entidad
   * @param {number} limit - Límite de registros
   * @returns {Promise<Array>} Historial de cambios
   */
  static async getEntityHistory(tenantId, entity, entityId, limit = 50) {
    try {
      const history = await prisma.auditLog.findMany({
        where: {
          tenantId,
          entity,
          entityId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return history;
    } catch (error) {
      logger.error(`Error al obtener historial: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene el historial de acciones de un usuario
   * @param {string} tenantId - ID del tenant
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Historial de acciones del usuario
   */
  static async getUserHistory(tenantId, userId, options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        entity = null,
        action = null,
        limit = 100
      } = options;

      const where = {
        tenantId,
        userId
      };

      if (entity) where.entity = entity;
      if (action) where.action = action;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const history = await prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return history;
    } catch (error) {
      logger.error(`Error al obtener historial de usuario: ${error.message}`);
      return [];
    }
  }
}

export default AuditService;