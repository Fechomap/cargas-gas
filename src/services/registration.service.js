// src/services/registration.service.js
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../../index.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar el registro y vinculación de tenants
 */
class RegistrationService {
  /**
   * Crea una nueva solicitud de registro
   * @param {Object} data - Datos de la solicitud
   * @returns {Promise<Object>} - Solicitud creada
   */
  async createRegistrationRequest(data) {
    try {
      const { companyName, contactName, contactPhone, contactEmail, requesterId, requesterUsername } = data;
      
      // Generar ID único
      const id = uuidv4();
      
      // Crear solicitud en base de datos
      const request = await prisma.registrationRequest.create({
        data: {
          id,
          companyName,
          contactName: contactName || '',
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          requesterId: requesterId.toString(),
          requesterUsername: requesterUsername || null,
          status: 'PENDING',
          updatedAt: new Date()
        }
      });
      
      logger.info(`Nueva solicitud de registro creada: ${id} para empresa "${companyName}"`);
      return request;
    } catch (error) {
      logger.error(`Error al crear solicitud de registro: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene todas las solicitudes pendientes
   * @returns {Promise<Array>} - Lista de solicitudes pendientes
   */
  async getPendingRequests() {
    try {
      return prisma.registrationRequest.findMany({
        where: {
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      logger.error(`Error al obtener solicitudes pendientes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Aprueba una solicitud y genera un token para la vinculación
   * @param {String} requestId - ID de la solicitud
   * @param {String} adminId - ID del administrador que aprueba
   * @returns {Promise<Object>} - Tenant creado y token
   */
  async approveRequest(requestId, adminId) {
    try {
      // Verificar que la solicitud existe
      const request = await prisma.registrationRequest.findUnique({
        where: { id: requestId }
      });
      
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }
      
      if (request.status !== 'PENDING') {
        throw new Error(`La solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
      }
      
      // Generar token único de 6 caracteres (3 letras + 3 números)
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin I, O para evitar confusiones
      const numbers = '23456789'; // Sin 0, 1 para evitar confusiones
      
      let token = '';
      for (let i = 0; i < 3; i++) {
        token += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      for (let i = 0; i < 3; i++) {
        token += numbers.charAt(Math.floor(Math.random() * numbers.length));
      }
      
      // Crear tenant (sin chatId todavía)
      const tenant = await prisma.tenant.create({
        data: {
          companyName: request.companyName,
          isActive: true,
          isApproved: false, // Será true cuando se vincule a un grupo
          registrationToken: token,
          contactName: request.contactName,
          contactPhone: request.contactPhone,
          contactEmail: request.contactEmail,
          chatId: `pending_${uuidv4()}` // Temporal hasta vinculación, debe ser único
        }
      });
      
      // Actualizar estado de la solicitud
      await prisma.registrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          processedBy: adminId.toString(),
          processedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      logger.info(`Solicitud ${requestId} aprobada. Token generado: ${token}`);
      return { tenant, token };
    } catch (error) {
      logger.error(`Error al aprobar solicitud: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Rechaza una solicitud de registro
   * @param {String} requestId - ID de la solicitud
   * @param {String} adminId - ID del administrador que rechaza
   * @param {String} notes - Notas sobre el rechazo
   * @returns {Promise<Object>} - Solicitud actualizada
   */
  async rejectRequest(requestId, adminId, notes = '') {
    try {
      // Verificar que la solicitud existe
      const request = await prisma.registrationRequest.findUnique({
        where: { id: requestId }
      });
      
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }
      
      if (request.status !== 'PENDING') {
        throw new Error(`La solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
      }
      
      // Actualizar estado de la solicitud
      const updatedRequest = await prisma.registrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          processedBy: adminId.toString(),
          processedAt: new Date(),
          updatedAt: new Date(),
          adminNotes: notes
        }
      });
      
      logger.info(`Solicitud ${requestId} rechazada por administrador ${adminId}`);
      return updatedRequest;
    } catch (error) {
      logger.error(`Error al rechazar solicitud: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Busca un tenant por su token de registro
   * @param {String} token - Token de registro
   * @returns {Promise<Object|null>} - Tenant encontrado o null
   */
  async findTenantByToken(token) {
    try {
      return prisma.tenant.findUnique({
        where: { registrationToken: token }
      });
    } catch (error) {
      logger.error(`Error al buscar tenant por token: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Vincula un tenant a un grupo de Telegram
   * @param {String} tenantId - ID del tenant
   * @param {String} chatId - ID del chat de Telegram
   * @returns {Promise<Object>} - Tenant actualizado
   */
  async linkTenantToGroup(tenantId, chatId) {
    try {
      // Verificar que el tenant existe
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });
      
      if (!tenant) {
        throw new Error('Tenant no encontrado');
      }
      
      // Verificar si el chatId ya está vinculado a otro tenant
      const existingTenant = await prisma.tenant.findUnique({
        where: { chatId: chatId.toString() }
      });
      
      if (existingTenant && existingTenant.id !== tenantId) {
        throw new Error('Este grupo ya está vinculado a otra empresa');
      }
      
      // Actualizar tenant con el chatId y activarlo
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          chatId: chatId.toString(),
          isApproved: true,
          registrationToken: null // Invalidar token después de usarlo
        }
      });
      
      logger.info(`Tenant ${tenantId} vinculado al grupo ${chatId}`);
      return updatedTenant;
    } catch (error) {
      logger.error(`Error al vincular tenant a grupo: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene una solicitud por ID
   * @param {String} requestId - ID de la solicitud
   * @returns {Promise<Object|null>} - Solicitud encontrada o null
   */
  async getRequestById(requestId) {
    try {
      return prisma.registrationRequest.findUnique({
        where: { id: requestId }
      });
    } catch (error) {
      logger.error(`Error al obtener solicitud por ID: ${error.message}`);
      throw error;
    }
  }
}

// Exportar singleton
export const registrationService = new RegistrationService();
