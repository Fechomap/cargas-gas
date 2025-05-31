// src/services/tenant.service.js
import { prisma } from '../db/index.js';

/**
 * Servicio para gestionar operaciones relacionadas con tenants (empresas)
 */
export class TenantService {
  /**
   * Crea un nuevo tenant
   * @param {Object} tenantData - Datos del tenant
   * @param {String} tenantData.chatId - ID del chat de Telegram
   * @param {String} tenantData.companyName - Nombre de la empresa
   * @returns {Promise<Object>} - Tenant creado
   */
  static async createTenant(tenantData) {
    return prisma.tenant.create({
      data: tenantData
    });
  }

  /**
   * Busca un tenant por su chatId
   * @param {String} chatId - ID del chat de Telegram
   * @returns {Promise<Object|null>} - Tenant encontrado o null
   */
  static async findTenantByChatId(chatId) {
    return prisma.tenant.findUnique({
      where: { chatId }
    });
  }

  /**
   * Obtiene o crea un tenant por su chatId
   * @param {Object} tenantData - Datos del tenant
   * @returns {Promise<Object>} - Tenant existente o creado
   */
  static async findOrCreateTenant(tenantData) {
    const existingTenant = await this.findTenantByChatId(tenantData.chatId);
    
    if (existingTenant) {
      return existingTenant;
    }
    
    return this.createTenant(tenantData);
  }

  /**
   * Actualiza un tenant existente
   * @param {String} tenantId - ID del tenant
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} - Tenant actualizado
   */
  static async updateTenant(tenantId, updateData) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: updateData
    });
  }

  /**
   * Obtiene o crea la configuración de un tenant
   * @param {String} tenantId - ID del tenant
   * @param {Object} settingsData - Datos de configuración (opcionales)
   * @returns {Promise<Object>} - Configuración del tenant
   */
  static async getOrCreateSettings(tenantId, settingsData = {}) {
    const existingSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });
    
    if (existingSettings) {
      return existingSettings;
    }
    
    return prisma.tenantSettings.create({
      data: {
        ...settingsData,
        tenantId
      }
    });
  }

  /**
   * Actualiza la configuración de un tenant
   * @param {String} tenantId - ID del tenant
   * @param {Object} settingsData - Datos de configuración a actualizar
   * @returns {Promise<Object>} - Configuración actualizada
   */
  static async updateSettings(tenantId, settingsData) {
    return prisma.tenantSettings.update({
      where: { tenantId },
      data: settingsData
    });
  }

  /**
   * Verifica si un tenant está activo
   * @param {String} chatId - ID del chat de Telegram
   * @returns {Promise<Boolean>} - True si está activo
   */
  static async isActiveTenant(chatId) {
    const tenant = await this.findTenantByChatId(chatId);
    if (!tenant) return false;
    
    // Verificar si está activo y si la suscripción sigue vigente
    if (!tenant.isActive) return false;
    
    if (tenant.subscriptionEnd && tenant.subscriptionEnd < new Date()) {
      // Suscripción expirada
      await this.updateTenant(tenant.id, { isActive: false });
      return false;
    }
    
    return true;
  }
}
