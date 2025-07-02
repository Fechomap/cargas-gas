// src/commands/registration/admin.commands.js
import { Markup } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { registrationService } from '../../services/registration.service.js';
import { notificationService } from '../../services/notification.service.js';

/**
 * Configura los comandos administrativos para gestión de solicitudes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupAdminCommands(bot) {
  // Referencia global al bot para notificaciones
  const botInstance = bot;

  // Comando para listar solicitudes pendientes
  bot.command('solicitudes', listPendingRequests);

  // Comando para aprobar solicitudes
  bot.command(['aprobar', 'aprobar_solicitud'], (ctx) => approveRequest(ctx, botInstance));

  // Comando para rechazar solicitudes
  bot.command(['rechazar', 'rechazar_solicitud'], (ctx) => rejectRequest(ctx, botInstance));

  // Callbacks para botones de aprobación/rechazo
  setupAdminCallbacks(bot);
}

/**
 * Lista las solicitudes de registro pendientes (solo para admins)
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 */
export async function listPendingRequests(ctx) {
  try {
    // Verificar que estemos en un chat privado
    if (ctx.chat.type !== 'private') {
      return ctx.reply('⚠️ Este comando solo puede ser utilizado en un chat privado con el bot.');
    }

    // Verificar si el usuario es administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('⛔ No tienes permiso para ejecutar este comando.');
    }

    // Obtener solicitudes pendientes
    const pendingRequests = await registrationService.getPendingRequests();

    if (pendingRequests.length === 0) {
      return ctx.reply('📋 No hay solicitudes de registro pendientes.');
    }

    // Enviar mensaje con lista de solicitudes
    let message = '📋 *Solicitudes de Registro Pendientes*\n\n';

    pendingRequests.forEach((request, index) => {
      message += `*${index + 1}. ${request.companyName}*\n`;
      message += `   • Contacto: ${request.contactName}\n`;
      if (request.contactPhone) message += `   • Teléfono: ${request.contactPhone}\n`;
      if (request.contactEmail) message += `   • Email: ${request.contactEmail}\n`;
      message += `   • Solicitante: ${request.requesterUsername ? '@' + request.requesterUsername : request.requesterId}\n`;
      message += `   • ID: \`${request.id}\`\n\n`;
    });

    message += '\nPara aprobar: /aprobar ID\nPara rechazar: /rechazar ID';

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error(`Error al listar solicitudes: ${error.message}`);
    await ctx.reply('❌ Ocurrió un error al obtener las solicitudes pendientes.');
  }
}

/**
 * Aprueba una solicitud de registro (solo para admins)
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {Telegraf} bot - Instancia del bot
 */
export async function approveRequest(ctx, bot) {
  try {
    // Verificar que estemos en un chat privado
    if (ctx.chat.type !== 'private') {
      return ctx.reply('⚠️ Este comando solo puede ser utilizado en un chat privado con el bot.');
    }

    // Verificar si el usuario es administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('⛔ No tienes permiso para ejecutar este comando.');
    }

    // Obtener ID de la solicitud del texto del comando
    const text = ctx.message.text.trim();
    const parts = text.split(' ');

    if (parts.length < 2) {
      return ctx.reply('⚠️ Formato incorrecto. Uso: /aprobar ID');
    }

    const requestId = parts[1];

    // Buscar la solicitud
    const request = await registrationService.getRequestById(requestId);
    if (!request) {
      return ctx.reply(`❌ Solicitud con ID ${requestId} no encontrada.`);
    }

    if (request.status !== 'PENDING') {
      return ctx.reply(`⚠️ Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
    }

    // Aprobar la solicitud
    const result = await registrationService.approveRequest(requestId, ctx.from.id);

    // Notificar al usuario
    await notificationService.notifyUserAboutApproval(bot, request, result.token);

    // Enviar mensaje de confirmación
    const successMessage =
      '✅ *SOLICITUD APROBADA*\n\n' +
      `*Empresa:* ${request.companyName}\n` +
      `*Contacto:* ${request.contactName}\n` +
      (request.contactPhone ? `*Teléfono:* ${request.contactPhone}\n` : '') +
      (request.contactEmail ? `*Email:* ${request.contactEmail}\n` : '') +
      `*Token generado:* \`${result.token}\`\n\n` +
      '✅ Usuario notificado exitosamente';

    await ctx.reply(successMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error(`Error al aprobar solicitud: ${error.message}`);
    await ctx.reply(`❌ Error al aprobar la solicitud: ${error.message}`);
  }
}

/**
 * Rechaza una solicitud de registro (solo para admins)
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {Telegraf} bot - Instancia del bot
 */
export async function rejectRequest(ctx, bot) {
  try {
    // Verificar que estemos en un chat privado
    if (ctx.chat.type !== 'private') {
      return ctx.reply('⚠️ Este comando solo puede ser utilizado en un chat privado con el bot.');
    }

    // Verificar si el usuario es administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('⛔ No tienes permiso para ejecutar este comando.');
    }

    // Obtener ID de la solicitud del texto del comando
    const text = ctx.message.text.trim();
    const parts = text.split(' ');

    if (parts.length < 2) {
      return ctx.reply('⚠️ Formato incorrecto. Uso: /rechazar ID [motivo]');
    }

    const requestId = parts[1];
    const reason = parts.length > 2 ? parts.slice(2).join(' ') : 'No especificado';

    // Buscar la solicitud
    const request = await registrationService.getRequestById(requestId);
    if (!request) {
      return ctx.reply(`❌ Solicitud con ID ${requestId} no encontrada.`);
    }

    if (request.status !== 'PENDING') {
      return ctx.reply(`⚠️ Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
    }

    // Rechazar la solicitud
    await registrationService.rejectRequest(requestId, ctx.from.id, reason);

    // Notificar al usuario
    await notificationService.notifyUserAboutRejection(bot, request, reason);

    // Enviar mensaje de confirmación
    const rejectMessage =
      '❌ *SOLICITUD RECHAZADA*\n\n' +
      `*Empresa:* ${request.companyName}\n` +
      `*Contacto:* ${request.contactName}\n` +
      (request.contactPhone ? `*Teléfono:* ${request.contactPhone}\n` : '') +
      (request.contactEmail ? `*Email:* ${request.contactEmail}\n` : '') +
      `*Motivo:* ${reason}\n\n` +
      '✅ Usuario notificado exitosamente';

    await ctx.reply(rejectMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error(`Error al rechazar solicitud: ${error.message}`);
    await ctx.reply(`❌ Error al rechazar la solicitud: ${error.message}`);
  }
}

/**
 * Verifica si un usuario es administrador
 * @param {number} userId - ID del usuario
 * @returns {boolean} - true si el usuario es administrador
 */
async function isAdmin(userId) {
  try {
    const adminIds = process.env.BOT_ADMIN_IDS ? process.env.BOT_ADMIN_IDS.split(',').map(id => Number(id.trim())) : [];

    // Verificar si el usuario está en la lista de administradores
    const isAdminUser = adminIds.includes(userId);

    // Loguear para depuración
    logger.info(`Verificando si usuario ${userId} es admin: ${isAdminUser} (admins: ${adminIds.join(', ')})`);

    return isAdminUser;
  } catch (error) {
    logger.error(`Error al verificar si es admin: ${error.message}`);
    return false;
  }
}

/**
 * Configura callbacks para botones de aprobación/rechazo
 * @param {Telegraf} bot - Instancia del bot
 */
function setupAdminCallbacks(bot) {
  bot.action(/^admin_approve_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      logger.info(`Recibida solicitud de aprobación del ID ${requestId} por usuario ${ctx.from.id}`);

      // Verificar si es administrador
      const adminCheck = await isAdmin(ctx.from.id);
      logger.info(`Permitiendo comando en chat privado para admin: ${adminCheck ? 'SÍ' : 'NO'}`);

      if (!adminCheck) {
        logger.warn(`Usuario ${ctx.from.id} intentó aprobar la solicitud ${requestId} pero no es administrador`);
        return ctx.answerCbQuery('No tienes permisos para ejecutar esta acción.', { show_alert: true });
      }

      logger.info(`Administrador ${ctx.from.id} aprobando solicitud ${requestId}`);
      await ctx.answerCbQuery('Procesando aprobación...', { show_alert: false });

      const request = await registrationService.getRequestById(requestId);
      if (!request) {
        return ctx.editMessageText(`❌ Solicitud con ID ${requestId} no encontrada.`);
      }

      if (request.status !== 'PENDING') {
        return ctx.editMessageText(`⚠️ Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
      }

      const result = await registrationService.approveRequest(requestId, ctx.from.id);
      await notificationService.notifyUserAboutApproval(bot, request, result.token);

      const successMessage =
        '✅ *SOLICITUD APROBADA*\n\n' +
        `*Empresa:* ${request.companyName}\n` +
        `*Contacto:* ${request.contactName}\n` +
        (request.contactPhone ? `*Teléfono:* ${request.contactPhone}\n` : '') +
        (request.contactEmail ? `*Email:* ${request.contactEmail}\n` : '') +
        `*Token generado:* \`${result.token}\`\n\n` +
        '✅ Usuario notificado exitosamente';

      await ctx.editMessageText(successMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error(`Error al aprobar solicitud: ${error.message}`);
      await ctx.answerCbQuery(`Error: ${error.message}`, { show_alert: true });
    }
  });

  bot.action(/^admin_reject_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];

      if (!await isAdmin(ctx.from.id)) {
        return ctx.answerCbQuery('No tienes permisos para ejecutar esta acción.', { show_alert: true });
      }

      await ctx.answerCbQuery('Procesando rechazo...', { show_alert: false });

      const request = await registrationService.getRequestById(requestId);
      if (!request) {
        return ctx.editMessageText(`❌ Solicitud con ID ${requestId} no encontrada.`);
      }

      if (request.status !== 'PENDING') {
        return ctx.editMessageText(`⚠️ Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
      }

      const reason = 'Rechazada por administrador';
      await registrationService.rejectRequest(requestId, ctx.from.id, reason);
      await notificationService.notifyUserAboutRejection(bot, request, reason);

      const rejectMessage =
        '❌ *SOLICITUD RECHAZADA*\n\n' +
        `*Empresa:* ${request.companyName}\n` +
        `*Contacto:* ${request.contactName}\n` +
        (request.contactPhone ? `*Teléfono:* ${request.contactPhone}\n` : '') +
        (request.contactEmail ? `*Email:* ${request.contactEmail}\n` : '') +
        `*Motivo:* ${reason}\n\n` +
        '✅ Usuario notificado exitosamente';

      await ctx.editMessageText(rejectMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Error al rechazar solicitud: ${error.message}`);
      await ctx.answerCbQuery(`Error: ${error.message}`, { show_alert: true });
    }
  });
}

// Segunda definición de isAdmin eliminada para evitar duplicados
// La función isAdmin ya está definida arriba en el archivo
