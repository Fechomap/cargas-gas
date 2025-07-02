// src/services/notification.service.js
import { Markup } from 'telegraf';
import { logger } from '../utils/logger.js';

/**
 * Servicio para manejar notificaciones del sistema
 */
class NotificationService {
  /**
   * Notifica a los administradores sobre una nueva solicitud
   * @param {Telegraf} bot - Instancia del bot
   * @param {Object} request - Solicitud de registro
   */
  async notifyAdminsAboutRequest(bot, request) {
    try {
      // Obtener la lista de administradores desde las variables de entorno
      const adminIds = process.env.BOT_ADMIN_IDS ? process.env.BOT_ADMIN_IDS.split(',').map(id => Number(id.trim())) : [];

      if (adminIds.length === 0) {
        logger.warn('No hay administradores configurados para recibir notificaciones');
        return;
      }

      logger.info(`Notificando a ${adminIds.length} administradores sobre la solicitud ${request.id}`);

      // Crear mensaje de notificación
      const message =
        '🆕 *NUEVA SOLICITUD DE REGISTRO*\n\n' +
        `*Empresa:* ${request.companyName}\n` +
        `*Contacto:* ${request.contactName}\n` +
        (request.contactPhone ? `*Teléfono:* ${request.contactPhone}\n` : '') +
        (request.contactEmail ? `*Email:* ${request.contactEmail}\n` : '') +
        `*Solicitante:* ${request.requesterUsername ? '@' + request.requesterUsername : request.requesterId}\n` +
        `*ID:* \`${request.id}\`\n\n` +
        '⏳ *Esperando aprobación*';

      // Crear botones inline para aprobar/rechazar
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '✅ APROBAR',
              callback_data: `admin_approve_${request.id}`
            },
            {
              text: '❌ RECHAZAR',
              callback_data: `admin_reject_${request.id}`
            }
          ]
        ]
      };

      // Enviar notificación a cada admin
      for (const adminId of adminIds) {
        try {
          await bot.telegram.sendMessage(adminId, message, {
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard
          });
          logger.info(`Notificación enviada al admin ${adminId}`);
        } catch (error) {
          logger.error(`Error al notificar al admin ${adminId}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error al notificar a admins: ${error.message}`);
    }
  }

  /**
   * Notifica al usuario sobre la aprobación de su solicitud
   * @param {Telegraf} bot - Instancia del bot
   * @param {Object} request - Solicitud aprobada
   * @param {String} token - Token generado
   */
  async notifyUserAboutApproval(bot, request, token) {
    try {
      // PRIMER MENSAJE: Información principal
      const mainMessage =
        '✅ *¡Solicitud Aprobada!*\n\n' +
        `Tu solicitud de registro para *${request.companyName}* ha sido aprobada.\n\n` +
        `🔑 *Tu token de activación es:* \`${token}\`\n\n` +
        'Para completar el proceso:\n\n' +
        '1. Añade el bot a tu grupo de Telegram\n' +
        '2. Copia el comando de abajo y pégalo en tu grupo:\n\n' +
        'Este token es de un solo uso y expirará una vez utilizado.\n' +
        'Si tienes alguna duda, no dudes en contactarnos.';

      // SEGUNDO MENSAJE: Solo el comando (separado para fácil copy/paste)
      const commandMessage = `/vincular ${token}`;

      // Enviar primer mensaje
      await bot.telegram.sendMessage(request.requesterId, mainMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Ayuda', callback_data: 'register_help' }]
          ]
        }
      });

      // Enviar segundo mensaje (solo el comando) después de una pequeña pausa
      setTimeout(async () => {
        try {
          await bot.telegram.sendMessage(request.requesterId, commandMessage, {
            parse_mode: 'Markdown'
          });
          logger.info(`Comando de vinculación enviado por separado al usuario ${request.requesterId}`);
        } catch (error) {
          logger.error(`Error al enviar comando separado: ${error.message}`);
        }
      }, 1000); // Pausa de 1 segundo para que lleguen en orden

      logger.info(`Notificación de aprobación enviada al usuario ${request.requesterId}`);
    } catch (error) {
      logger.error(`Error al notificar aprobación: ${error.message}`);
    }
  }

  /**
   * Notifica al usuario sobre el rechazo de su solicitud
   * @param {Telegraf} bot - Instancia del bot
   * @param {Object} request - Solicitud rechazada
   * @param {String} reason - Motivo del rechazo
   */
  async notifyUserAboutRejection(bot, request, reason) {
    try {
      const message =
        '❌ *Solicitud Rechazada*\n\n' +
        `Lo sentimos, tu solicitud de registro para *${request.companyName}* ha sido rechazada.\n\n` +
        (reason ? `*Motivo:* ${reason}\n\n` : '') +
        'Si crees que se trata de un error o deseas más información, puedes contactar al administrador.';

      await bot.telegram.sendMessage(request.requesterId, message, { parse_mode: 'Markdown' });

      logger.info(`Notificación de rechazo enviada al usuario ${request.requesterId}`);
    } catch (error) {
      logger.error(`Error al notificar rechazo: ${error.message}`);
    }
  }
}

export const notificationService = new NotificationService();
