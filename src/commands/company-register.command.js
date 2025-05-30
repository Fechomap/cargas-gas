// src/commands/company-register.command.js
import { Markup } from 'telegraf';
import { logger } from '../utils/logger.js';
import { updateConversationState } from '../state/conversation.js';
import { registrationService } from '../services/registration.service.js';

/**
 * Configura los comandos para el sistema de registro de empresas
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupCompanyRegisterCommands(bot) {
  // Guardar referencia global al bot para usar en funciones de aprobación/rechazo
  const botInstance = bot;
  
  // 1. Comando para iniciar registro de empresa (solo en chat privado)
  bot.command('registrar_empresa', startCompanyRegistration);
  
  // 2. Comando para listar solicitudes pendientes (solo para admins)
  bot.command('solicitudes', listPendingRequests);
  
  // 3. Comando para aprobar solicitudes (solo para admins)
  bot.command(['aprobar', 'aprobar_solicitud'], (ctx) => approveRequest(ctx, botInstance));
  
  // 4. Comando para rechazar solicitudes (solo para admins)
  bot.command(['rechazar', 'rechazar_solicitud'], (ctx) => rejectRequest(ctx, botInstance));
  
  // 5. Comando para vincular grupo con token
  bot.command(['vincular', 'activar'], linkGroupWithToken);

  // NUEVOS: Manejadores para botones de aprobación/rechazo
  bot.action(/^admin_approve_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      
      if (!await isAdmin(ctx.from.id)) {
        return ctx.answerCbQuery('No tienes permisos para ejecutar esta acción.', { show_alert: true });
      }
      
      await ctx.answerCbQuery('Procesando aprobación...', { show_alert: false });
      
      const request = await registrationService.getRequestById(requestId);
      if (!request) {
        return ctx.editMessageText(`❌ Solicitud con ID ${requestId} no encontrada.`);
      }
      
      if (request.status !== 'PENDING') {
        return ctx.editMessageText(`⚠️ Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
      }
      
      const result = await registrationService.approveRequest(requestId, ctx.from.id);
      await notifyUserAboutApproval(bot, request, result.token);
      
      const successMessage = 
        `✅ **SOLICITUD APROBADA**\n\n` +
        `**Empresa:** ${request.companyName}\n` +
        `**Contacto:** ${request.contactName}\n` +
        (request.contactPhone ? `**Teléfono:** ${request.contactPhone}\n` : '') +
        (request.contactEmail ? `**Email:** ${request.contactEmail}\n` : '') +
        `**Token generado:** \`${result.token}\`\n\n` +
        `✅ Usuario notificado exitosamente`;
      
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
      await notifyUserAboutRejection(bot, request, reason);
      
      const rejectMessage = 
        `❌ **SOLICITUD RECHAZADA**\n\n` +
        `**Empresa:** ${request.companyName}\n` +
        `**Contacto:** ${request.contactName}\n` +
        (request.contactPhone ? `**Teléfono:** ${request.contactPhone}\n` : '') +
        (request.contactEmail ? `**Email:** ${request.contactEmail}\n` : '') +
        `**Motivo:** ${reason}\n\n` +
        `❌ Usuario notificado`;
      
      await ctx.editMessageText(rejectMessage, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`Error al rechazar solicitud: ${error.message}`);
      await ctx.answerCbQuery(`Error: ${error.message}`, { show_alert: true });
    }
  });
  
  // Manejar respuestas según el estado de la conversación
  bot.on('text', async (ctx, next) => {
    // Verificación más robusta del estado de la sesión
    const currentState = ctx.session?.state;
    
    // Imprimir debug para diagnosticar
    logger.debug(`Procesando texto con estado: ${currentState}, mensaje: "${ctx.message.text}", usuario: ${ctx.from?.id}`);
    
    // Solo procesar si estamos en un estado de registro de empresa
    if (!currentState || !currentState.startsWith('register_company_')) {
      logger.debug(`Ignorando mensaje, no está en estado de registro: ${currentState}`);
      return next();
    }
    
    logger.info(`Procesando respuesta para estado: ${currentState}`);
    
    try {
      const text = ctx.message.text;
      
      // Guardar referencia al bot para usar en las notificaciones
      ctx.botInstance = bot;
      
      // Asegurar que ctx.session.data existe
      if (!ctx.session.data) {
        logger.warn(`Inicializando ctx.session.data para usuario ${ctx.from?.id}`);
        ctx.session.data = {
          userId: ctx.from?.id,
          username: ctx.from?.username
        };
      }
      
      // Imprimir la estructura de la sesión para debug
      logger.debug(`Estructura de sesión: ${JSON.stringify(ctx.session)}`);
      
      switch (ctx.session.state) {
        case 'register_company_name':
          // Guardar nombre de la empresa y solicitar nombre de contacto
          logger.info(`Guardando nombre de empresa: ${text}`);
          ctx.session.data.companyName = text;
          await updateConversationState(ctx, 'register_company_contact_name');
          return await ctx.reply('¿Cuál es tu nombre completo? (persona de contacto)');
          
        case 'register_company_contact_name':
          // Guardar nombre de contacto y solicitar teléfono
          ctx.session.data.contactName = text;
          await updateConversationState(ctx, 'register_company_contact_phone');
          return await ctx.reply('¿Cuál es tu número de teléfono? (opcional, escribir "saltar" para omitir)');
          
        case 'register_company_contact_phone':
          // Guardar teléfono y solicitar email
          if (text.toLowerCase() === 'saltar') {
            ctx.session.data.contactPhone = null;
          } else {
            ctx.session.data.contactPhone = text;
          }
          
          await updateConversationState(ctx, 'register_company_contact_email');
          return await ctx.reply('¿Cuál es tu correo electrónico? (opcional, escribir "saltar" para omitir)');
          
        case 'register_company_contact_email':
          // Guardar email y solicitar confirmación
          if (text.toLowerCase() === 'saltar') {
            ctx.session.data.contactEmail = null;
          } else {
            ctx.session.data.contactEmail = text;
          }
          
          await updateConversationState(ctx, 'register_company_confirm');
          
          // Mostrar resumen para confirmación
          let confirmMessage = '📋 *Resumen de Solicitud*\n\n';
          confirmMessage += `*Empresa:* ${ctx.session.data.companyName}\n`;
          confirmMessage += `*Contacto:* ${ctx.session.data.contactName}\n`;
          
          if (ctx.session.data.contactPhone) {
            confirmMessage += `*Teléfono:* ${ctx.session.data.contactPhone}\n`;
          }
          
          if (ctx.session.data.contactEmail) {
            confirmMessage += `*Email:* ${ctx.session.data.contactEmail}\n`;
          }
          
          confirmMessage += '\n¿Estos datos son correctos? Puedes responder "Si" o pulsar el botón de confirmación.';
          
          return await ctx.reply(confirmMessage, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('✅ Confirmar', 'register_company_confirm_yes')],
              [Markup.button.callback('❌ Cancelar', 'register_company_confirm_no')]
            ])
          });

        case 'register_company_confirm':
          // Manejar respuestas de texto para la confirmación
          const confirmResponses = ['si', 'sí', 's', 'yes', 'y', 'confirmar', 'ok'];
          const rejectResponses = ['no', 'n', 'cancelar', 'cancel'];
          
          logger.info(`Procesando confirmación por texto: "${text}"`);
          
          if (confirmResponses.includes(text.toLowerCase())) {
            logger.info('Confirmación recibida por texto');
            
            // Ejecutar la misma lógica que el botón de confirmación
            // Crear solicitud de registro
            const requestData = {
              companyName: ctx.session.data.companyName,
              contactName: ctx.session.data.contactName,
              contactPhone: ctx.session.data.contactPhone,
              contactEmail: ctx.session.data.contactEmail,
              requesterId: ctx.from.id,
              requesterUsername: ctx.from.username
            };
            
            try {
              logger.info(`Creando solicitud con datos: ${JSON.stringify(requestData)}`);
              const request = await registrationService.createRegistrationRequest(requestData);
              logger.info(`Solicitud creada con ID: ${request.id}`);
              
              // Mensaje de éxito
              await ctx.reply(
                '✅ *Solicitud Enviada Correctamente*\n\n' +
                'Tu solicitud de registro ha sido recibida y está pendiente de aprobación. ' +
                'Recibirás una notificación cuando sea procesada.\n\n' +
                `*ID de solicitud:* \`${request.id}\`\n\n` +
                'Por favor, guarda este ID para referencia futura.',
                {
                  parse_mode: 'Markdown'
                }
              );
              
              // Notificar a admins
              logger.info('Notificando a admins sobre la nueva solicitud');
              await notifyAdminsAboutRequest(bot, request);
              
              // Limpiar estado
              logger.info('Limpiando estado de conversación');
              await updateConversationState(ctx, 'idle');
              return;
            } catch (error) {
              logger.error(`Error al confirmar registro de empresa por texto: ${error.message}`);
              logger.error(error.stack);
              await ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.');
              await updateConversationState(ctx, 'idle');
              return;
            }
          } else if (rejectResponses.includes(text.toLowerCase())) {
            logger.info('Rechazo recibido por texto');
            await ctx.reply(
              '❌ Registro cancelado. ¿Deseas intentar nuevamente?',
              {
                reply_markup: Markup.inlineKeyboard([
                  [Markup.button.callback('Sí, registrar de nuevo', 'restart_company_registration')],
                  [Markup.button.callback('No, salir', 'exit_registration')]
                ])
              }
            );
            await updateConversationState(ctx, 'idle');
            return;
          } else {
            // Respuesta no reconocida
            return await ctx.reply(
              'Por favor, confirma con "Si" o "No", o usa los botones que aparecen debajo del mensaje anterior.',
              {
                reply_markup: Markup.inlineKeyboard([
                  [Markup.button.callback('✅ Confirmar', 'register_company_confirm_yes')],
                  [Markup.button.callback('❌ Cancelar', 'register_company_confirm_no')]
                ])
              }
            );
          }
      }
    } catch (error) {
      logger.error(`Error en registro de empresa: ${error.message}`);
      await ctx.reply('Ocurrió un error en el registro. Por favor, intenta nuevamente.');
      await updateConversationState(ctx, 'idle');
    }
    
    return next();
  });
  
  // Manejar confirmación de registro
  bot.action('register_company_confirm_yes', async (ctx) => {
    try {
      await ctx.answerCbQuery('Procesando solicitud...');
      
      // Crear solicitud de registro
      const requestData = {
        companyName: ctx.session.data.companyName,
        contactName: ctx.session.data.contactName,
        contactPhone: ctx.session.data.contactPhone,
        contactEmail: ctx.session.data.contactEmail,
        requesterId: ctx.from.id,
        requesterUsername: ctx.from.username
      };
      
      const request = await registrationService.createRegistrationRequest(requestData);
      
      // Mensaje de éxito
      await ctx.editMessageText(
        '✅ *Solicitud Enviada Correctamente*\n\n' +
        'Tu solicitud de registro ha sido recibida y está pendiente de aprobación. ' +
        'Recibirás una notificación cuando sea procesada.\n\n' +
        `*ID de solicitud:* \`${request.id}\`\n\n` +
        'Por favor, guarda este ID para referencia futura.',
        {
          parse_mode: 'Markdown'
        }
      );
      
      // Notificar a admins (esto requiere configuración adicional)
      await notifyAdminsAboutRequest(bot, request);
      
      // Limpiar estado
      await updateConversationState(ctx, 'idle');
    } catch (error) {
      logger.error(`Error al confirmar registro de empresa: ${error.message}`);
      await ctx.answerCbQuery('Error al procesar solicitud');
      await ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.');
      await updateConversationState(ctx, 'idle');
    }
  });
  
  bot.action('register_company_confirm_no', async (ctx) => {
    try {
      await ctx.answerCbQuery('Registro cancelado');
      await ctx.editMessageText(
        '❌ Registro cancelado. ¿Deseas intentar nuevamente?',
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Sí, registrar de nuevo', 'restart_company_registration')],
            [Markup.button.callback('No, salir', 'exit_registration')]
          ])
        }
      );
      await updateConversationState(ctx, 'idle');
    } catch (error) {
      logger.error(`Error al cancelar registro: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  });
  
  bot.action('restart_company_registration', async (ctx) => {
    await ctx.answerCbQuery('Reiniciando registro');
    await startCompanyRegistration(ctx);
  });
  
  bot.action('exit_registration', async (ctx) => {
    await ctx.answerCbQuery('Saliendo del registro');
    await ctx.editMessageText('Has salido del proceso de registro. ¡Hasta pronto!');
  });
}

/**
 * Inicia el proceso de registro de empresa
 * @export
 */
export async function startCompanyRegistration(ctx) {
  try {
    // Verificar que está en chat privado
    if (ctx.chat.type !== 'private') {
      return ctx.reply(
        '⚠️ Este comando debe usarse en chat privado con el bot.\n\n' +
        'Por favor, inicia una conversación privada conmigo y ejecuta el comando allí.',
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url('Iniciar chat privado', `https://t.me/${ctx.botInfo.username}`)]
          ])
        }
      );
    }
    
    logger.info(`Usuario ${ctx.from.id} inició registro de empresa`);
    
    // Iniciar conversación
    await ctx.reply(
      '🏢 *REGISTRO DE EMPRESA*\n\n' +
      'Bienvenido al proceso de registro. A continuación, te solicitaré algunos datos básicos ' +
      'para registrar tu empresa en nuestro sistema.\n\n' +
      'Una vez completado el formulario, un administrador revisará tu solicitud y, ' +
      'si es aprobada, recibirás un token para activar el bot en tu grupo de Telegram.\n\n' +
      '¡Comencemos! 👇',
      { parse_mode: 'Markdown' }
    );
    
    // Solicitar nombre de empresa
    await ctx.reply('¿Cuál es el nombre de tu empresa?');
    
    // Actualizar estado de conversación
    await updateConversationState(ctx, 'register_company_name', {
      userId: ctx.from.id,
      username: ctx.from.username
    });
    
  } catch (error) {
    logger.error(`Error al iniciar registro de empresa: ${error.message}`);
    await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
  }
}

/**
 * Lista las solicitudes de registro pendientes (solo para admins)
 */
async function listPendingRequests(ctx) {
  try {
    // Verificar que es un administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('No tienes permisos para ejecutar este comando.');
    }
    
    // Obtener solicitudes pendientes
    const pendingRequests = await registrationService.getPendingRequests();
    
    if (pendingRequests.length === 0) {
      return ctx.reply('No hay solicitudes pendientes de aprobación.');
    }
    
    // Construir mensaje con las solicitudes
    let message = '📋 *Solicitudes Pendientes*\n\n';
    
    pendingRequests.forEach((request, index) => {
      message += `${index + 1}. *${request.companyName}*\n`;
      message += `   📱 Contacto: ${request.contactName}\n`;
      
      if (request.contactPhone) {
        message += `   ☎️ Teléfono: ${request.contactPhone}\n`;
      }
      
      if (request.contactEmail) {
        message += `   📧 Email: ${request.contactEmail}\n`;
      }
      
      message += `   🕒 Fecha: ${new Date(request.createdAt).toLocaleString()}\n`;
      message += `   🆔 ID: \`${request.id}\`\n\n`;
    });
    
    message += '*Comandos:*\n';
    message += '• Para aprobar: /aprobar [ID]\n';
    message += '• Para rechazar: /rechazar [ID]';
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error(`Error al listar solicitudes: ${error.message}`);
    await ctx.reply('Ocurrió un error al obtener las solicitudes pendientes.');
  }
}

/**
 * Aprueba una solicitud de registro (solo para admins)
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {Telegraf} bot - Instancia del bot
 */
async function approveRequest(ctx, bot) {
  try {
    // Verificar que es un administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('No tienes permisos para ejecutar este comando.');
    }
    
    // Obtener ID de la solicitud
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Uso correcto: /aprobar [ID de solicitud]');
    }
    
    const requestId = args[1];
    
    // Verificar que la solicitud existe
    const request = await registrationService.getRequestById(requestId);
    if (!request) {
      return ctx.reply(`Solicitud con ID ${requestId} no encontrada.`);
    }
    
    // Verificar estado
    if (request.status !== 'PENDING') {
      return ctx.reply(`Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
    }
    
    // Aprobar solicitud
    await ctx.reply(`Procesando aprobación para solicitud de "${request.companyName}"...`);
    
    const result = await registrationService.approveRequest(requestId, ctx.from.id);
    
    // Notificar al solicitante
    await notifyUserAboutApproval(bot, request, result.token);
    
    // Confirmar al admin
    await ctx.reply(
      `✅ Solicitud aprobada correctamente.\n\n` +
      `*Empresa:* ${request.companyName}\n` +
      `*Token generado:* \`${result.token}\`\n\n` +
      `Se ha notificado al usuario con las instrucciones.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error(`Error al aprobar solicitud: ${error.message}`);
    await ctx.reply(`Error: ${error.message}`);
  }
}

/**
 * Rechaza una solicitud de registro (solo para admins)
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {Telegraf} bot - Instancia del bot
 */
async function rejectRequest(ctx, bot) {
  try {
    // Verificar que es un administrador
    if (!await isAdmin(ctx.from.id)) {
      return ctx.reply('No tienes permisos para ejecutar este comando.');
    }
    
    // Obtener ID de la solicitud y motivo
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Uso correcto: /rechazar [ID de solicitud] [motivo opcional]');
    }
    
    const requestId = args[1];
    const reason = args.length > 2 ? args.slice(2).join(' ') : '';
    
    // Verificar que la solicitud existe
    const request = await registrationService.getRequestById(requestId);
    if (!request) {
      return ctx.reply(`Solicitud con ID ${requestId} no encontrada.`);
    }
    
    // Verificar estado
    if (request.status !== 'PENDING') {
      return ctx.reply(`Esta solicitud ya fue ${request.status === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
    }
    
    // Rechazar solicitud
    await ctx.reply(`Procesando rechazo para solicitud de "${request.companyName}"...`);
    
    await registrationService.rejectRequest(requestId, ctx.from.id, reason);
    
    // Notificar al solicitante
    await notifyUserAboutRejection(bot, request, reason);
    
    // Confirmar al admin
    await ctx.reply(
      `❌ Solicitud rechazada correctamente.\n\n` +
      `*Empresa:* ${request.companyName}\n` +
      `*Motivo:* ${reason || 'No especificado'}\n\n` +
      `Se ha notificado al usuario.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error(`Error al rechazar solicitud: ${error.message}`);
    await ctx.reply(`Error: ${error.message}`);
  }
}

/**
 * Vincula un grupo con un token de registro
 */
async function linkGroupWithToken(ctx) {
  try {
    // Verificar que está en un grupo
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply(
        '⚠️ Este comando debe usarse en un grupo.\n\n' +
        'Por favor, agrega el bot a tu grupo y ejecuta el comando allí.'
      );
    }
    
    // Obtener token del argumento
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply(
        '⚠️ Uso correcto: /vincular [TOKEN]\n\n' +
        'El token de activación te fue proporcionado cuando se aprobó tu solicitud de registro.'
      );
    }
    
    const token = args[1].toUpperCase();
    
    // Verificar el token
    const tenant = await registrationService.findTenantByToken(token);
    
    if (!tenant) {
      return ctx.reply(
        '❌ Token no válido o ya utilizado.\n\n' +
        'Por favor, verifica que estás utilizando el token correcto.\n' +
        'Si el problema persiste, contacta al administrador.'
      );
    }
    
    // Verificar que el grupo no esté ya vinculado
    const chatId = ctx.chat.id.toString();
    
    // Vincular grupo y activar tenant
    await ctx.reply('⏳ Procesando vinculación...');
    
    // Usar el método correcto para vincular el grupo con el token
    const updatedTenant = await registrationService.linkGroupWithToken(token, chatId);
    
    // Mensaje de éxito
    await ctx.reply(
      `✅ *¡Vinculación exitosa!*\n\n` +
      `La empresa *${updatedTenant.companyName}* ha sido correctamente vinculada a este grupo.\n\n` +
      `El bot ahora está activo y listo para usarse. Puedes probar con el comando /ayuda para ver las opciones disponibles.\n\n` +
      `¡Gracias por usar nuestro servicio!`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error(`Error al vincular grupo: ${error.message}`);
    await ctx.reply(`Error: ${error.message}`);
  }
}

/**
 * Verifica si un usuario es administrador
 * @param {Number} userId - ID del usuario
 * @returns {Promise<Boolean>} - true si es admin, false en caso contrario
 */
async function isAdmin(userId) {
  // Intentar leer de ADMIN_USER_IDS primero, luego de BOT_ADMIN_IDS como fallback
  const adminIds = process.env.ADMIN_USER_IDS 
    ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
    : process.env.BOT_ADMIN_IDS
      ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
      : [];
  
  logger.debug(`IDs de administradores configurados: ${adminIds.join(', ')}`);
  const isAdminUser = adminIds.includes(userId.toString());
  logger.debug(`Usuario ${userId} ${isAdminUser ? 'ES' : 'NO es'} administrador`);
  
  return isAdminUser;
}

/**
 * Notifica a los administradores sobre una nueva solicitud
 * @param {Telegraf} bot - Instancia del bot
 * @param {Object} request - Solicitud de registro
 */
async function notifyAdminsAboutRequest(bot, request) {
  try {
    const adminIds = process.env.ADMIN_USER_IDS 
      ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
      : process.env.BOT_ADMIN_IDS
        ? process.env.BOT_ADMIN_IDS.split(',').map(id => id.trim())
        : [];
    
    logger.info(`Enviando notificaciones a administradores: ${adminIds.join(', ')}`);
    
    if (adminIds.length === 0) {
      logger.warn('No hay administradores configurados para notificaciones');
      return;
    }
    
    const message = 
      `🔔 **Nueva Solicitud de Registro**\n\n` +
      `**Empresa:** ${request.companyName}\n` +
      `**Contacto:** ${request.contactName}\n` +
      (request.contactPhone ? `**Teléfono:** ${request.contactPhone}\n` : '') +
      (request.contactEmail ? `**Email:** ${request.contactEmail}\n` : '') +
      `**Solicitante:** ${request.requesterUsername ? '@' + request.requesterUsername : request.requesterId}\n` +
      `**ID:** \`${request.id}\`\n\n` +
      `⏳ **Esperando aprobación**`;
    
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
async function notifyUserAboutApproval(bot, request, token) {
  try {
    // PRIMER MENSAJE: Información principal
    const mainMessage = 
      `✅ *¡Solicitud Aprobada!*\n\n` +
      `Tu solicitud de registro para *${request.companyName}* ha sido aprobada.\n\n` +
      `🔑 *Tu token de activación es:* \`${token}\`\n\n` +
      `Para completar el proceso:\n\n` +
      `1. Añade el bot a tu grupo de Telegram\n` +
      `2. Copia el comando de abajo y pégalo en tu grupo:\n\n` +
      `Este token es de un solo uso y expirará una vez utilizado.\n` +
      `Si tienes alguna duda, no dudes en contactarnos.`;
    
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
async function notifyUserAboutRejection(bot, request, reason) {
  try {
    const message = 
      `❌ *Solicitud Rechazada*\n\n` +
      `Lo sentimos, tu solicitud de registro para *${request.companyName}* ha sido rechazada.\n\n` +
      (reason ? `*Motivo:* ${reason}\n\n` : '') +
      `Si crees que se trata de un error o deseas más información, puedes contactar al administrador.`;
    
    await bot.telegram.sendMessage(request.requesterId, message, { parse_mode: 'Markdown' });
    
    logger.info(`Notificación de rechazo enviada al usuario ${request.requesterId}`);
  } catch (error) {
    logger.error(`Error al notificar rechazo: ${error.message}`);
  }
}
