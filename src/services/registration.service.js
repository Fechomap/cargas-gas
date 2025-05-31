// src/services/registration.service.js
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../db/index.js';
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
      
      // Crear tenant (sin chatId real todavía, pero isApproved=true para que pueda ser usado)
      const tenant = await prisma.tenant.create({
        data: {
          companyName: request.companyName,
          isActive: true,
          isApproved: true, // Marcamos como aprobado aunque no tenga un grupo vinculado aún
          registrationToken: token,
          contactName: request.contactName,
          contactPhone: request.contactPhone,
          contactEmail: request.contactEmail,
          chatId: `pending_${uuidv4()}`, // Temporal hasta vinculación, debe ser único
          settings: {
            create: {
              // Usando los campos correctos del esquema TenantSettings
              currency: "MXN",
              timezone: "America/Mexico_City",
              allowPhotoSkip: true,
              requireSaleNumber: false
            }
          }
        },
        include: {
          settings: true
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
   * Vincula un grupo con un tenant usando un token
   * @param {Object} options - Opciones para la vinculación
   * @param {String} options.token - Token de registro
   * @param {String} options.chatId - ID del chat/grupo de Telegram
   * @param {String} [options.chatTitle] - Título del chat (opcional)
   * @returns {Promise<Object>} - Resultado de la operación con el tenant vinculado
   */
  async linkGroupWithToken(options) {
    try {
      logger.info(`Intento de vinculación con token: ${JSON.stringify(options)}`);
      
      // Validar que tenemos el token
      if (!options || !options.token) {
        logger.error('Token no proporcionado para la vinculación');
        return { success: false, error: 'Token no proporcionado' };
      }
      
      // Normalizar token (quitar espacios, convertir a mayúsculas)
      const normalizedToken = String(options.token).trim().toUpperCase();
      const chatId = options.chatId;
      
      // Buscar tenant con el token
      const tenant = await prisma.tenant.findFirst({
        where: { registrationToken: normalizedToken },
        include: { settings: true }
      });
      
      if (!tenant) {
        return { success: false, error: 'Token inválido o expirado' };
      }
      
      // Verificar que el tenant no esté ya vinculado a otro grupo
      if (tenant.chatId && !tenant.chatId.startsWith('pending_')) {
        return { success: false, error: 'Este token ya ha sido utilizado' };
      }
      
      // Verificar que el grupo no esté ya vinculado a otro tenant
      const existingTenant = await prisma.tenant.findFirst({
        where: { 
          chatId: chatId.toString(),
          NOT: { id: tenant.id }
        }
      });
      
      if (existingTenant) {
        return { success: false, error: 'Este grupo ya está vinculado a otra empresa' };
      }
      
      try {
        // Actualizar tenant con el chatId del grupo (sin usar chatTitle que no existe en el modelo)
        const updatedTenant = await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            chatId: chatId.toString(),
            isApproved: true, // Confirmar aprobación
            registrationToken: null, // Invalidar token
            // Agregar nota con el título del chat si es necesario
            notes: options.chatTitle ? `Grupo: ${options.chatTitle}` : tenant.notes
          },
          include: { settings: true }
        });
        
        logger.info(`Grupo ${chatId} vinculado exitosamente con tenant ${tenant.id} (${tenant.companyName})`);
        return { success: true, tenant: updatedTenant };  
      } catch (updateError) {
        logger.error(`Error al actualizar tenant durante la vinculación: ${updateError.message}`);
        return { success: false, error: 'Error al vincular grupo con la empresa' };
      }
    } catch (error) {
      logger.error(`Error al vincular grupo: ${error.message}`);
      return { success: false, error: `Error al vincular grupo: ${error.message}` };
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
